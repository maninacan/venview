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
  expiresAt?: string | null;      // ISO; access-token expiry
}

export interface PosLocation { id: string; name: string; }

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
  end.setUTCHours(26);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

// Thrown when a capability isn't supported by the company's provider.
export class PosUnsupportedError extends Error {}
