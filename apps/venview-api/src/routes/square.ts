import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { encryptToken, getSquareBaseUrl, getSquareToken } from '../lib/square.js';
import { createContext } from '../context/index.js';

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
    if (!ctx.user) return void res.status(401).json({ error: 'Unauthorized' });

    const companyId = req.query['companyId'] as string;
    if (!companyId) return void res.status(400).json({ error: 'companyId required' });

    // Verify company membership
    const { data: member } = await supabase
      .from('CompanyMembers')
      .select('role')
      .eq('companyId', companyId)
      .eq('userId', ctx.user.id)
      .single();
    if (!member) return void res.status(403).json({ error: 'Forbidden' });

    // Purge stale states
    await supabase
      .from('OAuthState')
      .delete()
      .lt('createdAt', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    const state = randomBytes(24).toString('hex');
    await supabase.from('OAuthState').insert({
      state,
      companyId,
      userId: ctx.user.id,
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
    console.error('Square OAuth start error:', err);
    res.status(500).json({ error: 'Failed to start OAuth' });
  }
});

// ── GET /api/square/oauth/callback ───────────────────────────────────────────
// Public endpoint — Square redirects here after user authorizes.
router.get('/square/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error: oauthError } = req.query;

  const clientUrl = process.env['CLIENT_URL'] ?? 'http://localhost:4200';

  if (oauthError) {
    console.error('Square OAuth error:', oauthError);
    return void res.redirect(`${clientUrl}/companies`);
  }

  if (!code || !state) {
    return void res.status(400).send('Missing code or state');
  }

  // Validate and consume state
  const { data: stateRow } = await supabase
    .from('OAuthState')
    .select('companyId, userId')
    .eq('state', state as string)
    .single();

  if (!stateRow) {
    return void res.status(400).send('Invalid or expired state');
  }

  const { companyId } = stateRow as { companyId: string; userId: string };
  await supabase.from('OAuthState').delete().eq('state', String(state));

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
    } catch { /* non-fatal */ }

    // Upsert SquareConnection (per-company)
    await supabase.from('SquareConnection').upsert(
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

    console.log(`✅ Square OAuth connected: company=${companyId} merchant=${merchant_id}`);
    res.redirect(`${clientUrl}/companies/${companyId}/settings?sq=connected`);
  } catch (err) {
    const axiosErr = err as { response?: { data: unknown } };
    console.error('Square OAuth token exchange failed:', axiosErr.response?.data ?? err);
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
    console.error('Square disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect Square' });
  }
});

export default router;
