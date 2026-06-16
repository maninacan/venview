import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { encryptToken, getSquareBaseUrl, getSquareToken } from '../lib/square.js';
import { createContext } from '../context/index.js';
import logger from '../lib/logger.js';

const router: IRouter = Router();

const SQUARE_APP_ID = process.env['SQUARE_APP_ID'] ?? '';
const SQUARE_APP_SECRET = process.env['SQUARE_APP_SECRET'] ?? '';
const SQUARE_OAUTH_REDIRECT = process.env['SQUARE_OAUTH_REDIRECT'] ??
  `${process.env['CLIENT_URL'] ?? 'http://localhost:3000'}/api/square/oauth/callback`;

const SQUARE_SCOPES = [
  'TIMECARDS_READ',
  'TIMECARDS_SETTINGS_READ',
  'EMPLOYEES_READ',
  'ORDERS_READ',
  'PAYMENTS_READ',
  'MERCHANT_PROFILE_READ',
  'ITEMS_READ',
].join(' ');

// ── GET /api/square/oauth/start?companyId=<id> ────────────────────────────────
// Returns the OAuth URL as JSON. Client navigates to it after an authenticated fetch.
router.get('/square/oauth/start', async (req: Request, res: Response) => {
  try {
    const ctx = await createContext(req);
    if (!ctx.user) {
      logger.warn('square.oauth.start: unauthenticated request');
      return void res.status(401).json({ error: 'Unauthorized' });
    }

    const companyId = req.query['companyId'] as string;
    if (!companyId) {
      logger.warn('square.oauth.start: missing companyId', { userId: ctx.user.id });
      return void res.status(400).json({ error: 'companyId required' });
    }

    logger.info('square.oauth.start: initiating', { userId: ctx.user.id, companyId });

    // Verify company membership
    const { data: member, error: memberErr } = await supabase
      .from('CompanyMembers')
      .select('role')
      .eq('companyId', companyId)
      .eq('userId', ctx.user.id)
      .single();
    if (memberErr) logger.warn('square.oauth.start: membership lookup error', { userId: ctx.user.id, companyId, error: memberErr.message });
    if (!member) {
      logger.warn('square.oauth.start: user not a member of company', { userId: ctx.user.id, companyId });
      return void res.status(403).json({ error: 'Forbidden' });
    }

    // Purge stale states
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { error: purgeErr } = await supabase.from('OAuthState').delete().lt('createdAt', cutoff);
    if (purgeErr) logger.warn('square.oauth.start: failed to purge stale states', { error: purgeErr.message });

    const state = randomBytes(24).toString('hex');
    const { error: insertErr } = await supabase.from('OAuthState').insert({
      state,
      companyId,
      userId: ctx.user.id,
    });

    if (insertErr) {
      logger.error('square.oauth.start: failed to insert state', { userId: ctx.user.id, companyId, error: insertErr.message });
      return void res.status(500).json({ error: 'Failed to start OAuth' });
    }

    logger.info('square.oauth.start: state stored', {
      userId: ctx.user.id,
      companyId,
      state,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    const params = new URLSearchParams({
      client_id: SQUARE_APP_ID,
      scope: SQUARE_SCOPES,
      session: 'false',
      state,
      redirect_uri: SQUARE_OAUTH_REDIRECT,
      response_type: 'code',
    });

    res.json({ url: `${getSquareBaseUrl()}/oauth2/authorize?${params.toString()}` });
  } catch (err) {
    logger.error('square.oauth.start: unexpected error', { error: err });
    res.status(500).json({ error: 'Failed to start OAuth' });
  }
});

// ── GET /api/square/oauth/callback ───────────────────────────────────────────
// Public endpoint — Square redirects here after user authorizes.
router.get('/square/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error: oauthError } = req.query;

  const clientUrl = process.env['CLIENT_URL'] ?? 'http://localhost:4200';

  logger.info('square.oauth.callback: received', {
    hasCode: !!code,
    hasState: !!state,
    stateValue: state,
    oauthError: oauthError ?? null,
    timestamp: new Date().toISOString(),
  });

  if (oauthError) {
    logger.error('square.oauth.callback: Square returned an error', { oauthError });
    return void res.redirect(`${clientUrl}/companies`);
  }

  if (!code || !state) {
    logger.error('square.oauth.callback: missing code or state', { hasCode: !!code, hasState: !!state });
    return void res.status(400).send('Missing code or state');
  }

  // Validate and consume state
  const { data: stateRow, error: stateErr } = await supabase
    .from('OAuthState')
    .select('companyId, userId, createdAt')
    .eq('state', state as string)
    .single();

  if (stateErr) {
    logger.error('square.oauth.callback: state lookup DB error', {
      state,
      errorCode: stateErr.code,
      errorMessage: stateErr.message,
      errorDetails: stateErr.details,
    });
  }

  if (!stateRow) {
    logger.error('square.oauth.callback: state not found — invalid or expired', {
      state,
      dbError: stateErr?.message ?? null,
    });
    return void res.status(400).send('Invalid or expired state');
  }

  const { companyId, userId, createdAt } = stateRow as { companyId: string; userId: string; createdAt: string };
  const ageMs = Date.now() - new Date(createdAt).getTime();

  logger.info('square.oauth.callback: state validated', {
    state,
    companyId,
    userId,
    stateCreatedAt: createdAt,
    stateAgeSeconds: Math.round(ageMs / 1000),
  });

  const { error: deleteErr } = await supabase.from('OAuthState').delete().eq('state', String(state));
  if (deleteErr) logger.warn('square.oauth.callback: failed to delete consumed state', { state, error: deleteErr.message });

  try {
    const tokenRes = await axios.post(
      `${getSquareBaseUrl()}/oauth2/token`,
      {
        client_id: SQUARE_APP_ID,
        client_secret: SQUARE_APP_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: SQUARE_OAUTH_REDIRECT,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const { access_token, refresh_token, merchant_id, expires_at } = tokenRes.data as {
      access_token: string;
      refresh_token: string;
      merchant_id: string;
      expires_at: string;
    };

    logger.info('square.oauth.callback: token exchange successful', { companyId, merchantId: merchant_id });

    // Try to fetch the merchant's first location name for display
    let locationName: string | null = null;
    let locationId: string | null = null;
    try {
      const locRes = await axios.get(`${getSquareBaseUrl()}/v2/locations`, {
        headers: { Authorization: `Bearer ${access_token}`, 'Square-Version': '2025-01-15' },
      });
      const locs = locRes.data?.locations ?? [];
      if (locs.length > 0) {
        locationId = locs[0].id;
        locationName = locs[0].name;
      }
    } catch (locErr) {
      logger.warn('square.oauth.callback: failed to fetch location info (non-fatal)', { companyId, error: locErr });
    }

    // Upsert SquareConnection (per-company)
    const { error: upsertErr } = await supabase.from('SquareConnection').upsert(
      {
        companyId,
        accessToken: encryptToken(access_token),
        refreshToken: encryptToken(refresh_token),
        merchantId: merchant_id,
        locationId,
        locationName,
        createdAt: expires_at,
      },
      { onConflict: 'companyId' }
    );
    if (upsertErr) logger.error('square.oauth.callback: failed to save connection', { companyId, error: upsertErr.message });

    logger.info('square.oauth.callback: connection saved', { companyId, merchantId: merchant_id, locationId, locationName });
    res.redirect(`${clientUrl}/companies/${companyId}/settings?sq=connected`);
  } catch (err) {
    const axiosErr = err as { response?: { data: unknown; status?: number } };
    logger.error('square.oauth.callback: token exchange failed', {
      companyId,
      httpStatus: axiosErr.response?.status,
      responseData: axiosErr.response?.data ?? String(err),
    });
    res.redirect(`${clientUrl}/companies/${companyId}/settings?sq=error`);
  }
});

// ── DELETE /api/square/disconnect/:companyId ──────────────────────────────────
router.delete('/square/disconnect/:companyId', async (req: Request, res: Response) => {
  try {
    const ctx = await createContext(req);
    if (!ctx.user) return void res.status(401).json({ error: 'Unauthorized' });

    const companyId = req.params['companyId'] as string;

    // Revoke token at Square before deleting
    try {
      const token = await getSquareToken(companyId);
      await axios.post(
        `${getSquareBaseUrl()}/oauth2/revoke`,
        { access_token: token, client_id: SQUARE_APP_ID },
        {
          headers: {
            Authorization: `Client ${SQUARE_APP_SECRET}`,
            'Content-Type': 'application/json',
            'Square-Version': '2025-01-15',
          },
        }
      );
    } catch { /* non-fatal — delete from DB regardless */ }

    await supabase.from('SquareConnection').delete().eq('companyId', companyId);
    res.json({ success: true });
  } catch (err) {
    logger.error('square.disconnect: unexpected error', { error: err });
    res.status(500).json({ error: 'Failed to disconnect Square' });
  }
});

export default router;
