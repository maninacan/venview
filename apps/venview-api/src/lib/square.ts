import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { SquareClient, SquareEnvironment } from 'square';
import { supabase } from './supabase.js';

// ── AES-256-GCM token encryption ─────────────────────────────────────────────
// Format: <iv_hex>:<authTag_hex>:<data_hex>

function getEncKey(): Buffer {
  const hex = process.env['TOKEN_ENCRYPTION_KEY'];
  if (!hex || hex.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncKey(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${data.toString('hex')}`;
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const decipher = createDecipheriv('aes-256-gcm', getEncKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
}

// ── Square environment helpers ────────────────────────────────────────────────

export function getSquareEnv(): SquareEnvironment {
  return (process.env['SQUARE_ENV'] ?? 'production') === 'sandbox'
    ? SquareEnvironment.Sandbox
    : SquareEnvironment.Production;
}

export function getSquareBaseUrl(): string {
  return getSquareEnv() === SquareEnvironment.Sandbox
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
}

// ── Unauthenticated Square client (for OAuth only) ────────────────────────────
export function getSquareOAuthClient(): SquareClient {
  return new SquareClient({
    token: '',
    environment: getSquareEnv(),
  });
}

// ── Token retrieval + refresh ─────────────────────────────────────────────────

async function refreshSquareToken(companyId: string, row: Record<string, unknown>): Promise<string> {
  const refreshEnc = row['refreshToken'] as string | null;
  if (!refreshEnc) throw new Error('Cannot refresh Square token: no refresh token stored.');

  const oauthClient = getSquareOAuthClient();
  const tokenResponse = await oauthClient.oAuth.obtainToken({
    clientId: process.env['SQUARE_APP_ID']!,
    clientSecret: process.env['SQUARE_APP_SECRET']!,
    grantType: 'refresh_token',
    refreshToken: decryptToken(refreshEnc),
  });

  const accessToken = tokenResponse.accessToken!;
  const newRefresh = tokenResponse.refreshToken!;
  const expiresAt = tokenResponse.expiresAt;

  await supabase.from('SquareConnection').update({
    accessToken: encryptToken(accessToken),
    refreshToken: encryptToken(newRefresh),
    merchantId: tokenResponse.merchantId,
    createdAt: expiresAt ?? new Date().toISOString(),
  }).eq('companyId', companyId);

  return accessToken;
}

export async function getSquareToken(companyId: string): Promise<string> {
  const { data, error } = await supabase
    .from('SquareConnection')
    .select('accessToken, refreshToken, createdAt')
    .eq('companyId', companyId)
    .single();

  if (error || !data) {
    throw new Error('Square account not connected. Please connect via Settings.');
  }

  const row = data as Record<string, unknown>;
  const accessEnc = row['accessToken'] as string | null;
  if (!accessEnc) throw new Error('Square connection has no access token. Please reconnect.');

  // Proactively refresh if token is expiring within 30 days
  const expiresAt = row['createdAt'] as string | null;
  if (expiresAt && row['refreshToken']) {
    const expiresDate = new Date(expiresAt);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (expiresDate < thirtyDaysFromNow) {
      return refreshSquareToken(companyId, row);
    }
  }

  return decryptToken(accessEnc);
}

export async function getSquareClient(companyId: string): Promise<SquareClient> {
  const token = await getSquareToken(companyId);
  return new SquareClient({ token, environment: getSquareEnv() });
}
