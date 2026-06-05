import type { AppContext } from '../../context/index.js';
import { requireAuth, requireCompanyMember } from '../../context/index.js';
import { supabase } from '../../lib/supabase.js';

export const formTemplateResolvers = {
  Query: {
    formTemplates: async (_: unknown, { companyId }: { companyId: string }, ctx: AppContext) => {
      requireAuth(ctx);
      await requireCompanyMember(companyId, ctx.user!.id);
      const { data } = await supabase
        .from('FormTemplate')
        .select('*')
        .eq('companyId', companyId)
        .order('createdAt', { ascending: false });
      return data ?? [];
    },
  },

  Mutation: {
    saveFormTemplate: async (
      _: unknown,
      { companyId, input }: { companyId: string; input: Record<string, unknown> },
      ctx: AppContext
    ) => {
      requireAuth(ctx);
      await requireCompanyMember(companyId, ctx.user!.id);

      const { data, error } = await supabase
        .from('FormTemplate')
        .insert({ ...input, companyId, createdAt: new Date().toISOString() })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },

    activateFormTemplate: async (
      _: unknown,
      { companyId, templateId }: { companyId: string; templateId: string },
      ctx: AppContext
    ) => {
      requireAuth(ctx);
      await requireCompanyMember(companyId, ctx.user!.id);

      // Deactivate all first, then activate the chosen one
      await supabase.from('FormTemplate').update({ isActive: false }).eq('companyId', companyId);
      await supabase.from('FormTemplate').update({ isActive: true }).eq('id', templateId);
      return true;
    },
  },
};
