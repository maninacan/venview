import type { AppContext } from '../../context/index.js';
import { requireAuth, requireCompanyMember } from '../../context/index.js';
import { supabase } from '../../lib/supabase.js';
import { getSquareClient } from '../../lib/square.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getEventWithCompany(eventId: string) {
  const { data } = await supabase
    .from('EventInfo')
    .select('*, EventDays(*)')
    .eq('eventID', eventId)
    .single();
  return data as Record<string, unknown> | null;
}

async function assertEventAccess(eventId: string, ctx: AppContext) {
  requireAuth(ctx);
  const event = await getEventWithCompany(eventId);
  if (!event) throw new Error('Event not found');
  await requireCompanyMember(event['companyId'] as string, ctx.user!.id);
  return event;
}

function buildDateWindow(event: Record<string, unknown>): { startAt: string; endAt: string } {
  const days = (event['EventDays'] as Array<Record<string, unknown>> | null) ?? [];

  let startDate: string | null = null;
  let endDate: string | null = null;

  if (days.length > 0) {
    const sorted = [...days].sort((a, b) => String(a['eventDate']).localeCompare(String(b['eventDate'])));
    startDate = sorted[0]['eventDate'] as string;
    endDate = sorted[sorted.length - 1]['eventDate'] as string;
  } else {
    startDate = event['eventDate'] as string | null;
    endDate = (event['endDate'] as string | null) ?? startDate;
  }

  if (!startDate) throw new Error('Event has no date set');

  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date((endDate ?? startDate) + 'T00:00:00Z');
  end.setUTCHours(26);

  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

// ── Resolvers ─────────────────────────────────────────────────────────────────

export const salesResolvers = {
  Mutation: {
    updateManualSales: async (
      _: unknown,
      { eventId, input }: { eventId: string; input: Record<string, unknown> },
      ctx: AppContext
    ) => {
      await assertEventAccess(eventId, ctx);

      const grossSales = Number(input['grossSales'] ?? 0);
      const refunds = Number(input['refunds'] ?? 0);
      const discounts = Number(input['discounts'] ?? 0);
      const totalCollected = Number(input['totalCollected'] ?? 0);
      const netSales = grossSales - refunds - discounts;

      const upsertData = { eventID: eventId, grossSales, netSales, refunds, discounts, totalCollected, updatedAt: new Date().toISOString() };

      const { data: existing } = await supabase.from('SalesSummary').select('id').eq('eventID', eventId).single();
      const { data, error } = existing
        ? await supabase.from('SalesSummary').update(upsertData).eq('eventID', eventId).select().single()
        : await supabase.from('SalesSummary').insert(upsertData).select().single();

      if (error) throw new Error(error.message);
      return data;
    },

    updateTaxOverride: async (
      _: unknown,
      { eventId, taxRate }: { eventId: string; taxRate: number },
      ctx: AppContext
    ) => {
      await assertEventAccess(eventId, ctx);

      const { data: existing } = await supabase.from('SalesSummary').select('id').eq('eventID', eventId).single();
      const update = { eventID: eventId, taxRate, taxOverride: true, updatedAt: new Date().toISOString() };
      const { data, error } = existing
        ? await supabase.from('SalesSummary').update({ taxRate, taxOverride: true }).eq('eventID', eventId).select().single()
        : await supabase.from('SalesSummary').insert(update).select().single();

      if (error) throw new Error(error.message);
      return data;
    },

    syncSquareSales: async (_: unknown, { eventId }: { eventId: string }, ctx: AppContext) => {
      const event = await assertEventAccess(eventId, ctx);
      const companyId = event['companyId'] as string;

      if (!event['squareLocationId']) {
        throw new Error('Event has no Square location linked. Edit the event and select a Square Location first.');
      }

      const squareClient = await getSquareClient(companyId);
      const locationId = event['squareLocationId'] as string;
      const { startAt, endAt } = buildDateWindow(event);

      // ── Fetch orders (paginated) ────────────────────────────────────────────
      const allOrders: Array<Record<string, unknown>> = [];
      let cursor: string | undefined;
      do {
        const ordersResponse = await squareClient.orders.search({
          locationIds: [locationId],
          query: {
            filter: {
              dateTimeFilter: { createdAt: { startAt, endAt } },
              stateFilter: { states: ['COMPLETED' as const] },
            },
          },
          ...(cursor ? { cursor } : {}),
        });
        for (const order of ordersResponse.orders ?? []) {
          allOrders.push(order as unknown as Record<string, unknown>);
        }
        cursor = ordersResponse.cursor ?? undefined;
      } while (cursor);

      // ── Fetch payments (Page-based) ─────────────────────────────────────────
      const allPayments: Array<Record<string, unknown>> = [];
      const paymentsPage = await squareClient.payments.list({ locationId, beginTime: startAt, endTime: endAt });
      for await (const payment of paymentsPage) {
        allPayments.push(payment as unknown as Record<string, unknown>);
      }

      // ── Aggregate totals from orders ────────────────────────────────────────
      let grossSales = 0, discounts = 0, tips = 0;
      const itemMap = new Map<string, { name: string; qty: number }>();

      for (const order of allOrders) {
        const totalMoney = order['totalMoney'] as { amount?: bigint } | null;
        const discountMoney = order['totalDiscountMoney'] as { amount?: bigint } | null;
        const tipMoney = order['totalTipMoney'] as { amount?: bigint } | null;
        const taxMoney = order['totalTaxMoney'] as { amount?: bigint } | null;

        grossSales += (Number(totalMoney?.amount ?? 0) - Number(taxMoney?.amount ?? 0) - Number(tipMoney?.amount ?? 0)) / 100;
        discounts += Number(discountMoney?.amount ?? 0) / 100;
        tips += Number(tipMoney?.amount ?? 0) / 100;

        for (const item of (order['lineItems'] as Array<Record<string, unknown>> | null) ?? []) {
          const name = (item['name'] as string ?? '').trim();
          const qty = Number(item['quantity'] ?? 0);
          if (!name) continue;
          itemMap.set(name, { name, qty: (itemMap.get(name)?.qty ?? 0) + qty });
        }
      }

      // ── Aggregate from payments ─────────────────────────────────────────────
      let squareFees = 0, totalCollected = 0, refunds = 0;
      for (const payment of allPayments) {
        totalCollected += Number((payment['amountMoney'] as { amount?: bigint } | null)?.amount ?? 0) / 100;
        refunds += Number((payment['refundedMoney'] as { amount?: bigint } | null)?.amount ?? 0) / 100;
        for (const fee of (payment['processingFee'] as Array<{ effectiveMoney?: { amount?: bigint } }> | null) ?? []) {
          squareFees += Math.abs(Number(fee.effectiveMoney?.amount ?? 0)) / 100;
        }
      }

      const netSales = grossSales - refunds - discounts;

      // ── Match items to inventory via POS mappings ───────────────────────────
      const { data: mappings } = await supabase
        .from('PosItemMapping')
        .select('posItemName, inventoryId, VendorInventory(itemName, unitCost)')
        .eq('companyId', companyId);

      const inventoryRows: Array<Record<string, unknown>> = [];
      let unmatchedCount = 0;

      for (const [, item] of itemMap) {
        const mapping = (mappings ?? []).find(
          (m: Record<string, unknown>) => String(m['posItemName']).toLowerCase() === item.name.toLowerCase()
        );
        const inv = mapping ? (mapping as Record<string, unknown>)['VendorInventory'] as Record<string, unknown> | null : null;
        const unitCost = inv ? Number(inv['unitCost'] ?? 0) : null;
        if (unitCost == null) unmatchedCount++;
        inventoryRows.push({ eventID: eventId, name: item.name, quantitySold: item.qty, unitPrice: unitCost, totalCost: unitCost != null ? unitCost * item.qty : null });
      }

      // ── Upsert SalesSummary ─────────────────────────────────────────────────
      const salesData = { eventID: eventId, grossSales: +grossSales.toFixed(2), netSales: +netSales.toFixed(2), discounts: +discounts.toFixed(2), refunds: +refunds.toFixed(2), tips: +tips.toFixed(2), squareFees: +squareFees.toFixed(2), totalCollected: +totalCollected.toFixed(2), updatedAt: new Date().toISOString() };
      const { data: existingSales } = await supabase.from('SalesSummary').select('id').eq('eventID', eventId).single();
      if (existingSales) {
        await supabase.from('SalesSummary').update(salesData).eq('eventID', eventId);
      } else {
        await supabase.from('SalesSummary').insert(salesData);
      }

      // ── Replace InventorySales ──────────────────────────────────────────────
      await supabase.from('InventorySales').delete().eq('eventID', eventId);
      if (inventoryRows.length > 0) await supabase.from('InventorySales').insert(inventoryRows);

      return { success: true, message: `Synced ${allOrders.length} orders. ${unmatchedCount} item(s) missing inventory cost.`, unmatchedCount };
    },

    syncSquareLabor: async (_: unknown, { eventId }: { eventId: string }, ctx: AppContext) => {
      const event = await assertEventAccess(eventId, ctx);
      const companyId = event['companyId'] as string;
      if (!event['squareLocationId']) throw new Error('Event has no Square location linked.');

      const squareClient = await getSquareClient(companyId);
      const locationId = event['squareLocationId'] as string;
      const { startAt, endAt } = buildDateWindow(event);

      // ── Fetch timecards using workday filter ────────────────────────────────
      const allTimecards: Array<Record<string, unknown>> = [];
      let cursor: string | undefined;
      const startDate = startAt.split('T')[0];
      const endDate = endAt.split('T')[0];
      do {
        const response = await squareClient.labor.searchTimecards({
          query: {
            filter: {
              locationIds: [locationId],
              workday: { dateRange: { startDate, endDate }, matchTimecardsBy: 'START_AT' },
            },
          },
          ...(cursor ? { cursor } : {}),
        });
        for (const tc of response.timecards ?? []) {
          allTimecards.push(tc as unknown as Record<string, unknown>);
        }
        cursor = response.cursor ?? undefined;
      } while (cursor);

      // ── Look up team member wages ───────────────────────────────────────────
      const memberWageMap = new Map<string, { name: string; wage: number }>();
      const memberIds = [...new Set(allTimecards.map(tc => tc['teamMemberId'] as string).filter(Boolean))];

      await Promise.all(memberIds.map(async memberId => {
        try {
          // List wages for this team member
          const wagesPage = await squareClient.labor.teamMemberWages.list({ teamMemberId: memberId, limit: 1 });
          const wages = wagesPage.data ?? [];
          const wage = wages[0] as Record<string, unknown> | undefined;
          const hourlyRate = wage ? Number((wage['hourlyRate'] as { amount?: bigint } | null)?.amount ?? 0) / 100 : 0;

          // Get member name
          const memberResponse = await squareClient.teamMembers.get({ teamMemberId: memberId });
          const member = memberResponse.teamMember as Record<string, unknown> | null;
          const name = member
            ? `${member['givenName'] ?? ''} ${member['familyName'] ?? ''}`.trim() || memberId
            : memberId;

          memberWageMap.set(memberId, { name, wage: hourlyRate });
        } catch {
          memberWageMap.set(memberId, { name: memberId, wage: 0 });
        }
      }));

      // ── Build labor rows ────────────────────────────────────────────────────
      const laborRows = allTimecards.map(tc => {
        const memberId = tc['teamMemberId'] as string;
        const clockInEvent = tc['clockInEvent'] as Record<string, unknown> | null;
        const clockOutEvent = tc['clockOutEvent'] as Record<string, unknown> | null;
        const clockIn = new Date(clockInEvent?.['createdAt'] as string ?? startAt);
        const clockOut = clockOutEvent ? new Date(clockOutEvent['createdAt'] as string) : new Date();
        const hours = Math.round((clockOut.getTime() - clockIn.getTime()) / 36000) / 100;
        const member = memberWageMap.get(memberId) ?? { name: memberId, wage: 0 };
        return { eventID: eventId, name: member.name, hours, wage: member.wage };
      });

      await supabase.from('EventLabor').delete().eq('eventID', eventId);
      if (laborRows.length > 0) await supabase.from('EventLabor').insert(laborRows);

      return { success: true, message: `Synced ${laborRows.length} timecard(s).`, unmatchedCount: 0 };
    },

    updateAdjustments: async (
      _: unknown,
      { eventId, tips, posFee }: { eventId: string; tips?: number; posFee?: number },
      ctx: AppContext
    ) => {
      await assertEventAccess(eventId, ctx);
      if (posFee !== undefined) await supabase.from('EventExpenses').update({ posFee }).eq('eventID', eventId);
      if (tips !== undefined) {
        const { data: ex } = await supabase.from('SalesSummary').select('id').eq('eventID', eventId).single();
        if (ex) await supabase.from('SalesSummary').update({ tips }).eq('eventID', eventId);
      }
      return true;
    },
  },

  Query: {
    squareStatus: async (_: unknown, { companyId }: { companyId: string }, ctx: AppContext) => {
      requireAuth(ctx);
      await requireCompanyMember(companyId, ctx.user!.id);
      const { data } = await supabase.from('SquareConnection').select('locationId, locationName').eq('companyId', companyId).single();
      if (!data) return { connected: false };
      return { connected: true, locationId: (data as Record<string, unknown>)['locationId'], locationName: (data as Record<string, unknown>)['locationName'] };
    },

    squareLocations: async (_: unknown, { companyId }: { companyId: string }, ctx: AppContext) => {
      requireAuth(ctx);
      await requireCompanyMember(companyId, ctx.user!.id);
      try {
        const squareClient = await getSquareClient(companyId);
        const response = await squareClient.locations.list();
        return (response.locations ?? []).map((loc) => {
          const l = loc as Record<string, unknown>;
          return { id: l['id'], name: l['name'] };
        });
      } catch { return []; }
    },

    squareCatalog: async (_: unknown, { companyId }: { companyId: string }, ctx: AppContext) => {
      requireAuth(ctx);
      await requireCompanyMember(companyId, ctx.user!.id);
      try {
        const squareClient = await getSquareClient(companyId);
        const items: Array<Record<string, unknown>> = [];
        const page = await squareClient.catalog.list({ types: 'ITEM' });
        for await (const obj of page) {
          const catalogObj = obj as unknown as Record<string, unknown>;
          const itemData = catalogObj['itemData'] as Record<string, unknown> | null;
          for (const v of (itemData?.['variations'] ?? []) as Array<Record<string, unknown>>) {
            const varData = v['itemVariationData'] as Record<string, unknown> | null;
            items.push({ posItemId: v['id'], posItemName: itemData?.['name'] ?? '', variationName: varData?.['name'] ?? 'Regular', price: Number((varData?.['priceMoney'] as { amount?: bigint } | null)?.amount ?? 0) / 100 });
          }
        }
        return items;
      } catch { return []; }
    },
  },
};
