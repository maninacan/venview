// Provider-agnostic POS adapter interface. Each integration (Square today;
// Shopify/Toast later) implements this; the rest of the app talks only to the
// registry, never to a specific provider.

export type PosProviderKey = 'square' | 'shopify' | 'toast';

export interface PosCapabilities {
  sales: boolean;
  labor: boolean;
  catalog: boolean;
}

export interface PosTokens {
  accessToken: string;
  refreshToken?: string | null;
  externalId?: string | null;     // merchant / shop / restaurant id
  locationId?: string | null;
  locationName?: string | null;
  currency?: string | null;       // ISO 4217 of the default location, if known
  expiresAt?: string | null;      // ISO; access-token expiry
}

export interface PosLocation { id: string; name: string; currency?: string | null }

export interface PosCatalogItem {
  posItemId: string;
  posItemName: string;
  variationName: string;
  price: number;
}

// Normalized sales aggregate the provider returns; persistence is shared.
export interface PosSalesPull {
  grossSales: number;
  discounts: number;
  refunds: number;
  tips: number;
  processingFees: number;   // provider processing fees (stored in SalesSummary.squareFees)
  totalCollected: number;
  taxCollected: number;
  items: Array<{ name: string; qty: number }>;
  orderCount: number;
}

export interface PosLaborPull {
  rows: Array<{ name: string; hours: number; wage: number }>;
}

// The event shape the adapters need to scope a date window.
export interface PosEvent {
  posLocationId?: string | null;
  eventDate?: string | null;
  endDate?: string | null;
  EventDays?: Array<Record<string, unknown>> | null;
}

export interface PosProvider {
  key: PosProviderKey;
  displayName: string;
  capabilities: PosCapabilities;
  implemented: boolean;
  /** Build the provider's OAuth authorize URL. */
  getAuthUrl(companyId: string, state: string): string | Promise<string>;
  /** Exchange an auth code for tokens (+ default location). */
  exchangeCode(code: string): Promise<PosTokens>;
  /** Best-effort token revocation on disconnect. */
  revoke?(companyId: string): Promise<void>;
  listLocations(companyId: string): Promise<PosLocation[]>;
  listCatalog(companyId: string): Promise<PosCatalogItem[]>;
  pullSales(companyId: string, event: PosEvent): Promise<PosSalesPull>;
  pullLabor(companyId: string, event: PosEvent): Promise<PosLaborPull>;
}

// Shared event date window for sales/labor queries.
export function buildDateWindow(event: PosEvent): { startAt: string; endAt: string } {
  const days = (event.EventDays as Array<Record<string, unknown>> | null) ?? [];
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (days.length > 0) {
    const sorted = [...days].sort((a, b) => String(a['eventDate']).localeCompare(String(b['eventDate'])));
    startDate = sorted[0]['eventDate'] as string;
    endDate = sorted[sorted.length - 1]['eventDate'] as string;
  } else {
    startDate = event.eventDate ?? null;
    endDate = event.endDate ?? startDate;
  }
  if (!startDate) throw new Error('Event has no date set');
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date((endDate ?? startDate) + 'T00:00:00Z');
  // Guard against invalid / corrupt dates (e.g. a stray pre-2000 day) so we
  // surface a clear message instead of a raw provider error.
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start.getUTCFullYear() < 2000) {
    throw new Error("This event has an invalid date. Please check the event's dates in its details and try again.");
  }
  end.setUTCHours(26);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

// Thrown when a capability isn't supported by the company's provider.
export class PosUnsupportedError extends Error {}

// True when a provider API error is an authentication failure (dead/revoked/
// wrong-app token) — i.e. the user needs to reconnect the POS.
export function isPosAuthError(err: unknown): boolean {
  const e = err as { statusCode?: number; message?: unknown; errors?: Array<{ category?: string; code?: string }> } | null;
  if (!e) return false;
  if (e.statusCode === 401) return true;
  const msg = typeof e.message === 'string' ? e.message : '';
  if (/status code:\s*401/i.test(msg) || /AUTHENTICATION_ERROR|UNAUTHORIZED/i.test(msg)) return true;
  if (Array.isArray(e.errors) && e.errors.some(x => x?.category === 'AUTHENTICATION_ERROR' || x?.code === 'UNAUTHORIZED')) return true;
  return false;
}
