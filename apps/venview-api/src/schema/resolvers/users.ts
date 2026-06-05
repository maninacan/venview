import type { AppContext } from '../../context/index.js';
import { requireAuth } from '../../context/index.js';
import { supabase } from '../../lib/supabase.js';

export const userResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: AppContext) => {
      requireAuth(ctx);

      const { data: companies } = await supabase
        .from('CompanyMembers')
        .select('companyId, role, Companies(*)')
        .eq('userId', ctx.user.id);

      const companyList = (companies ?? []).map((row: Record<string, unknown>) => {
        const company = row['Companies'] as Record<string, unknown>;
        return { ...company, myRole: row['role'] };
      });

      return {
        id: ctx.user.id,
        email: ctx.user.email,
        isAdmin: ctx.isAdmin,
        companies: companyList,
      };
    },
  },
};
