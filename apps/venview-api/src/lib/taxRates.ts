import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import zipcodes from 'zipcodes';

export interface TaxRateLookup {
  stateRate: number;   // decimal, e.g. 0.047
  localRate: number;   // combined county + city + special districts
  combinedRate: number;
  jurisdiction: { state: string; county: string; city: string };
}

// Validate a TaxJar token with a lightweight rate lookup. Distinguishes a
// rejected token (auth failure) from a transient network problem so the caller
// can give a precise error and never store an unverified token.
export async function verifyTaxjarToken(token: string): Promise<'valid' | 'invalid' | 'unreachable'> {
  if (!token.trim()) return 'invalid';
  try {
    await axios.get('https://api.taxjar.com/v2/rates/90210', {
      headers: { Authorization: `Bearer ${token.trim()}` },
      timeout: 8000,
    });
    return 'valid';
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    return status === 401 || status === 403 ? 'invalid' : 'unreachable';
  }
}

// Look up the state + combined-local sales tax rate for a US ZIP, using the
// company's own TaxJar token.
//
// Provider boundary: this single function isolates the rate source so it can be
// swapped (TaxJar today; another API or a static dataset later). Returns null
// on any failure / missing token so callers degrade to manual entry.
export async function lookupTaxRates(zip: string, token: string): Promise<TaxRateLookup | null> {
  const clean = (zip ?? '').trim().slice(0, 5);
  if (!/^\d{5}$/.test(clean)) return null;
  if (!token) return null;

  try {
    const res = await axios.get(`https://api.taxjar.com/v2/rates/${clean}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });
    const r = (res.data as { rate?: Record<string, unknown> })?.rate;
    if (!r) return null;

    const stateRate = Number(r['state_rate'] ?? 0);
    const combinedRate = Number(r['combined_rate'] ?? 0);
    const localRate = Math.max(0, +(combinedRate - stateRate).toFixed(6));

    // Fall back to the zipcodes package for names TaxJar may omit.
    const zc = zipcodes.lookup(clean);
    return {
      stateRate,
      localRate,
      combinedRate,
      jurisdiction: {
        state: String(r['state'] ?? zc?.state ?? ''),
        county: String(r['county'] ?? ''),
        city: String(r['city'] ?? zc?.city ?? ''),
      },
    };
  } catch {
    return null;
  }
}
