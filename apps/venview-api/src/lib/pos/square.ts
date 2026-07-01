import axios from 'axios';
import { getSquareClient, getSquareBaseUrl, getSquareToken } from '../square.js';
import {
  buildDateWindow,
  type PosProvider, type PosTokens, type PosLocation, type PosCatalogItem,
  type PosSalesPull, type PosLaborPull, type PosEvent,
} from './types.js';

const SQUARE_APP_ID = process.env['SQUARE_APP_ID'] ?? '';
const SQUARE_APP_SECRET = process.env['SQUARE_APP_SECRET'] ?? '';
const SQUARE_OAUTH_REDIRECT = process.env['SQUARE_OAUTH_REDIRECT'] ??
  `${process.env['CLIENT_URL'] ?? 'http://localhost:3000'}/api/square/oauth/callback`;

const SQUARE_SCOPES = [
  'TIMECARDS_READ', 'TIMECARDS_SETTINGS_READ', 'EMPLOYEES_READ',
  'ORDERS_READ', 'PAYMENTS_READ', 'MERCHANT_PROFILE_READ', 'ITEMS_READ',
].join(' ');

export const squareProvider: PosProvider = {
  key: 'square',
  displayName: 'Square',
  capabilities: { sales: true, labor: true, catalog: true },
  implemented: true,

  getAuthUrl(_companyId, state) {
    const params = new URLSearchParams({
      client_id: SQUARE_APP_ID,
      scope: SQUARE_SCOPES,
      session: 'false',
      state,
      redirect_uri: SQUARE_OAUTH_REDIRECT,
      response_type: 'code',
    });
    return `${getSquareBaseUrl()}/oauth2/authorize?${params.toString()}`;
  },

  async exchangeCode(code): Promise<PosTokens> {
    const tokenRes = await axios.post(
      `${getSquareBaseUrl()}/oauth2/token`,
      { client_id: SQUARE_APP_ID, client_secret: SQUARE_APP_SECRET, code, grant_type: 'authorization_code', redirect_uri: SQUARE_OAUTH_REDIRECT },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const { access_token, refresh_token, merchant_id, expires_at } = tokenRes.data as {
      access_token: string; refresh_token: string; merchant_id: string; expires_at: string;
    };

    // Best-effort: fetch first location for display + its currency.
    let locationId: string | null = null;
    let locationName: string | null = null;
    let currency: string | null = null;
    try {
      const locRes = await axios.get(`${getSquareBaseUrl()}/v2/locations`, {
        headers: { Authorization: `Bearer ${access_token}`, 'Square-Version': '2025-01-15' },
      });
      const locs = locRes.data?.locations ?? [];
      if (locs.length > 0) { locationId = locs[0].id; locationName = locs[0].name; currency = locs[0].currency ?? null; }
    } catch { /* non-fatal */ }

    return { accessToken: access_token, refreshToken: refresh_token, externalId: merchant_id, locationId, locationName, currency, expiresAt: expires_at };
  },

  async revoke(companyId) {
    const token = await getSquareToken(companyId);
    await axios.post(
      `${getSquareBaseUrl()}/oauth2/revoke`,
      { access_token: token, client_id: SQUARE_APP_ID },
      { headers: { Authorization: `Client ${SQUARE_APP_SECRET}`, 'Content-Type': 'application/json', 'Square-Version': '2025-01-15' } }
    );
  },

  async listLocations(companyId): Promise<PosLocation[]> {
    const client = await getSquareClient(companyId);
    const response = await client.locations.list();
    return (response.locations ?? []).map((loc) => {
      const l = loc as Record<string, unknown>;
      return { id: l['id'] as string, name: l['name'] as string, currency: (l['currency'] as string) ?? null };
    });
  },

  async listCatalog(companyId): Promise<PosCatalogItem[]> {
    const client = await getSquareClient(companyId);
    const items: PosCatalogItem[] = [];
    const page = await client.catalog.list({ types: 'ITEM' });
    for await (const obj of page) {
      const catalogObj = obj as unknown as Record<string, unknown>;
      const itemData = catalogObj['itemData'] as Record<string, unknown> | null;
      for (const v of (itemData?.['variations'] ?? []) as Array<Record<string, unknown>>) {
        const varData = v['itemVariationData'] as Record<string, unknown> | null;
        items.push({
          posItemId: v['id'] as string,
          posItemName: (itemData?.['name'] as string) ?? '',
          variationName: (varData?.['name'] as string) ?? 'Regular',
          price: Number((varData?.['priceMoney'] as { amount?: bigint } | null)?.amount ?? 0) / 100,
        });
      }
    }
    return items;
  },

  async pullSales(companyId, event: PosEvent): Promise<PosSalesPull> {
    const locationId = event.posLocationId;
    if (!locationId) throw new Error('Event has no POS location linked. Edit the event and select a location first.');
    const client = await getSquareClient(companyId);
    const { startAt, endAt } = buildDateWindow(event);

    const allOrders: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    do {
      const ordersResponse = await client.orders.search({
        locationIds: [locationId],
        query: { filter: { dateTimeFilter: { createdAt: { startAt, endAt } }, stateFilter: { states: ['COMPLETED' as const] } } },
        ...(cursor ? { cursor } : {}),
      });
      for (const order of ordersResponse.orders ?? []) allOrders.push(order as unknown as Record<string, unknown>);
      cursor = ordersResponse.cursor ?? undefined;
    } while (cursor);

    const allPayments: Array<Record<string, unknown>> = [];
    const paymentsPage = await client.payments.list({ locationId, beginTime: startAt, endTime: endAt });
    for await (const payment of paymentsPage) allPayments.push(payment as unknown as Record<string, unknown>);

    let grossSales = 0, discounts = 0, tips = 0, taxCollected = 0;
    const itemMap = new Map<string, { name: string; qty: number }>();
    for (const order of allOrders) {
      const totalMoney = order['totalMoney'] as { amount?: bigint } | null;
      const discountMoney = order['totalDiscountMoney'] as { amount?: bigint } | null;
      const tipMoney = order['totalTipMoney'] as { amount?: bigint } | null;
      const taxMoney = order['totalTaxMoney'] as { amount?: bigint } | null;
      grossSales += (Number(totalMoney?.amount ?? 0) - Number(taxMoney?.amount ?? 0) - Number(tipMoney?.amount ?? 0)) / 100;
      discounts += Number(discountMoney?.amount ?? 0) / 100;
      tips += Number(tipMoney?.amount ?? 0) / 100;
      taxCollected += Number(taxMoney?.amount ?? 0) / 100;
      for (const item of (order['lineItems'] as Array<Record<string, unknown>> | null) ?? []) {
        const name = (item['name'] as string ?? '').trim();
        const qty = Number(item['quantity'] ?? 0);
        if (!name) continue;
        itemMap.set(name, { name, qty: (itemMap.get(name)?.qty ?? 0) + qty });
      }
    }

    let processingFees = 0, totalCollected = 0, refunds = 0;
    for (const payment of allPayments) {
      totalCollected += Number((payment['amountMoney'] as { amount?: bigint } | null)?.amount ?? 0) / 100;
      refunds += Number((payment['refundedMoney'] as { amount?: bigint } | null)?.amount ?? 0) / 100;
      for (const fee of (payment['processingFee'] as Array<{ effectiveMoney?: { amount?: bigint } }> | null) ?? []) {
        processingFees += Math.abs(Number(fee.effectiveMoney?.amount ?? 0)) / 100;
      }
    }

    return {
      grossSales, discounts, refunds, tips, processingFees, totalCollected, taxCollected,
      items: [...itemMap.values()],
      orderCount: allOrders.length,
    };
  },

  async pullLabor(companyId, event: PosEvent): Promise<PosLaborPull> {
    const locationId = event.posLocationId;
    if (!locationId) throw new Error('Event has no POS location linked.');
    const client = await getSquareClient(companyId);
    const { startAt, endAt } = buildDateWindow(event);

    const allTimecards: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    const startDate = startAt.split('T')[0];
    const endDate = endAt.split('T')[0];
    do {
      const response = await client.labor.searchTimecards({
        query: { filter: { locationIds: [locationId], workday: { dateRange: { startDate, endDate }, matchTimecardsBy: 'START_AT' } } },
        ...(cursor ? { cursor } : {}),
      });
      for (const tc of response.timecards ?? []) allTimecards.push(tc as unknown as Record<string, unknown>);
      cursor = response.cursor ?? undefined;
    } while (cursor);

    const memberWageMap = new Map<string, { name: string; wage: number }>();
    const memberIds = [...new Set(allTimecards.map(tc => tc['teamMemberId'] as string).filter(Boolean))];
    await Promise.all(memberIds.map(async memberId => {
      try {
        const wagesPage = await client.labor.teamMemberWages.list({ teamMemberId: memberId, limit: 1 });
        const wage = (wagesPage.data ?? [])[0] as Record<string, unknown> | undefined;
        const hourlyRate = wage ? Number((wage['hourlyRate'] as { amount?: bigint } | null)?.amount ?? 0) / 100 : 0;
        const memberResponse = await client.teamMembers.get({ teamMemberId: memberId });
        const member = memberResponse.teamMember as Record<string, unknown> | null;
        const name = member ? `${member['givenName'] ?? ''} ${member['familyName'] ?? ''}`.trim() || memberId : memberId;
        memberWageMap.set(memberId, { name, wage: hourlyRate });
      } catch {
        memberWageMap.set(memberId, { name: memberId, wage: 0 });
      }
    }));

    const rows = allTimecards.map(tc => {
      const memberId = tc['teamMemberId'] as string;
      const clockInEvent = tc['clockInEvent'] as Record<string, unknown> | null;
      const clockOutEvent = tc['clockOutEvent'] as Record<string, unknown> | null;
      const clockIn = new Date(clockInEvent?.['createdAt'] as string ?? startAt);
      const clockOut = clockOutEvent ? new Date(clockOutEvent['createdAt'] as string) : new Date();
      const hours = Math.round((clockOut.getTime() - clockIn.getTime()) / 36000) / 100;
      const member = memberWageMap.get(memberId) ?? { name: memberId, wage: 0 };
      return { name: member.name, hours, wage: member.wage };
    });

    return { rows };
  },
};
