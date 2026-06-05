import { randomBytes } from 'crypto';
import type { AppContext } from '../../context/index.js';
import { requireAuth, requireCompanyMember } from '../../context/index.js';
import { supabase } from '../../lib/supabase.js';

function generateJoinCode(): string {
  return randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
}

export const companyResolvers = {
  Query: {
    company: async (_: unknown, { id }: { id: string }, ctx: AppContext) => {
      requireAuth(ctx);
      await requireCompanyMember(id, ctx.user.id);

      const { data, error } = await supabase
        .from('Companies')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) throw new Error('Company not found');
      return data;
    },
  },

  Mutation: {
    createCompany: async (
      _: unknown,
      { input }: { input: Record<string, unknown> },
      ctx: AppContext
    ) => {
      requireAuth(ctx);

      const joinCode = generateJoinCode();
      const { data: company, error } = await supabase
        .from('Companies')
        .insert({
          ...input,
          ownerId: ctx.user.id,
          joinCode,
          plan: 'starter',
          createdAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !company) throw new Error(error?.message ?? 'Failed to create company');

      // Add owner as member
      await supabase.from('CompanyMembers').insert({
        companyId: (company as Record<string, unknown>)['id'],
        userId: ctx.user.id,
        role: 'owner',
        joinedAt: new Date().toISOString(),
      });

      return company;
    },

    updateCompany: async (
      _: unknown,
      { id, input }: { id: string; input: Record<string, unknown> },
      ctx: AppContext
    ) => {
      requireAuth(ctx);
      await requireCompanyMember(id, ctx.user.id);

      const { data, error } = await supabase
        .from('Companies')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) throw new Error(error?.message ?? 'Failed to update company');
      return data;
    },

    deleteCompany: async (_: unknown, { id }: { id: string }, ctx: AppContext) => {
      requireAuth(ctx);
      const member = await requireCompanyMember(id, ctx.user.id);
      if (member.role !== 'owner') throw new Error('Only the owner can delete a company');

      await supabase.from('Companies').delete().eq('id', id);
      return true;
    },

    joinCompany: async (_: unknown, { joinCode }: { joinCode: string }, ctx: AppContext) => {
      requireAuth(ctx);

      const { data: company, error } = await supabase
        .from('Companies')
        .select('*')
        .eq('joinCode', joinCode.toUpperCase())
        .single();

      if (error || !company) throw new Error('Invalid join code');

      const companyId = (company as Record<string, unknown>)['id'] as string;

      // Check if already a member
      const { data: existing } = await supabase
        .from('CompanyMembers')
        .select('id')
        .eq('companyId', companyId)
        .eq('userId', ctx.user.id)
        .single();

      if (existing) return company;

      await supabase.from('CompanyMembers').insert({
        companyId,
        userId: ctx.user.id,
        role: 'member',
        joinedAt: new Date().toISOString(),
      });

      return company;
    },

    leaveCompany: async (_: unknown, { companyId }: { companyId: string }, ctx: AppContext) => {
      requireAuth(ctx);

      await supabase
        .from('CompanyMembers')
        .delete()
        .eq('companyId', companyId)
        .eq('userId', ctx.user.id);

      return true;
    },

    removeMember: async (
      _: unknown,
      { companyId, userId }: { companyId: string; userId: string },
      ctx: AppContext
    ) => {
      requireAuth(ctx);
      const membership = await requireCompanyMember(companyId, ctx.user.id);
      if (membership.role !== 'owner') throw new Error('Only the owner can remove members');

      await supabase
        .from('CompanyMembers')
        .delete()
        .eq('companyId', companyId)
        .eq('userId', userId);

      return true;
    },
  },

  Company: {
    members: async (company: Record<string, unknown>) => {
      const { data } = await supabase
        .from('CompanyMembers')
        .select('userId, role')
        .eq('companyId', company['id']);

      if (!data) return [];

      // Fetch emails from auth
      const memberList = await Promise.all(
        (data as Array<{ userId: string; role: string }>).map(async (m) => {
          const { data: user } = await supabase.auth.admin.getUserById(m.userId);
          return {
            userId: m.userId,
            email: user?.user?.email ?? '',
            role: m.role,
          };
        })
      );

      return memberList;
    },

    squareStatus: async (company: Record<string, unknown>) => {
      const { data } = await supabase
        .from('SquareConnection')
        .select('locationId, locationName')
        .eq('companyId', company['id'])
        .single();

      if (!data) return { connected: false };
      return {
        connected: true,
        locationId: (data as Record<string, unknown>)['locationId'],
        locationName: (data as Record<string, unknown>)['locationName'],
      };
    },
  },
};
