import type { AppContext } from '../../context/index.js';
import { requireAuth } from '../../context/index.js';
import { supabase } from '../../lib/supabase.js';

export const adminResolvers = {
  Query: {
    adminUsers: async (_: unknown, __: unknown, ctx: AppContext) => {
      requireAuth(ctx);
      if (!ctx.isAdmin) throw new Error('Forbidden');

      const { data: allMembers } = await supabase
        .from('CompanyMembers')
        .select('userId, role, Companies(id, name, plan)');

      // Group by userId
      const userMap = new Map<string, { userId: string; companies: Array<Record<string, unknown>> }>();
      for (const m of (allMembers ?? []) as Array<Record<string, unknown>>) {
        const uid = m['userId'] as string;
        if (!userMap.has(uid)) userMap.set(uid, { userId: uid, companies: [] });
        const company = m['Companies'] as Record<string, unknown> | null;
        if (company) userMap.get(uid)!.companies.push(company);
      }

      return Array.from(userMap.values()).map(u => ({
        userId: u.userId,
        email: '',
        companyCount: u.companies.length,
        companies: u.companies.map(c => ({
          id: c['id'],
          name: c['name'],
          plan: c['plan'],
          memberCount: 0,
        })),
      }));
    },
  },

  Mutation: {
    updateCompanyPlan: async (
      _: unknown,
      { companyId, plan }: { companyId: string; plan: string },
      ctx: AppContext
    ) => {
      requireAuth(ctx);
      if (!ctx.isAdmin) throw new Error('Forbidden');
      if (!['starter', 'pro'].includes(plan)) throw new Error('Invalid plan');

      const { data, error } = await supabase
        .from('Companies')
        .update({ plan, planUpdatedAt: new Date().toISOString() })
        .eq('id', companyId)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },

    updateUserPrefs: async (_: unknown, __: unknown, ctx: AppContext) => {
      requireAuth(ctx);
      return true;
    },
  },
};
