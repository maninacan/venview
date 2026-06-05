import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import {
  showToast,
  TableCellContentAlignEnum,
  ActiveTableFilterOption,
} from '@org/data';
import type { TableHeaderItem, TableDataRow, TableFilter } from '@org/data';
import { Table } from '@org/common-components';

const GET_ADMIN_USERS = gql`
  query GetAdminUsers {
    adminUsers {
      userId email
      companies { id name plan memberCount }
    }
  }
`;

const UPDATE_PLAN = gql`
  mutation UpdateCompanyPlan($companyId: ID!, $plan: String!) {
    updateCompanyPlan(companyId: $companyId, plan: $plan) { id name plan }
  }
`;

interface CompanyRow {
  id: string;
  name: string;
  plan: string;
  memberCount: number;
  ownerEmail: string;
}

const HEADERS: TableHeaderItem[] = [
  { id: 'name', headerLabel: 'Company' },
  { id: 'ownerEmail', headerLabel: 'Owner' },
  { id: 'plan', headerLabel: 'Plan' },
  { id: 'memberCount', headerLabel: 'Members', alignment: TableCellContentAlignEnum.RIGHT },
];

const PLAN_FILTER: TableFilter = {
  id: 'plan',
  value: 'Plan',
  options: [
    { key: 'all', value: 'all', label: 'All Plans', isAllOption: true },
    { key: 'starter', value: 'starter', label: 'Starter', filter: (row) => (row as CompanyRow).plan === 'starter' },
    { key: 'pro', value: 'pro', label: 'Pro', filter: (row) => (row as CompanyRow).plan === 'pro' },
  ],
};

const PAGE_SIZE = 20;

export function CompaniesPage() {
  const { data, loading, refetch } = useQuery(GET_ADMIN_USERS);
  const [updatePlan] = useMutation(UPDATE_PLAN);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<ActiveTableFilterOption[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setCurrentPage(1); }, [search, activeFilters]);

  const allCompanies = useMemo<CompanyRow[]>(() => {
    const users: { email: string; companies: Omit<CompanyRow, 'ownerEmail'>[] }[] = data?.adminUsers ?? [];
    return users.flatMap(u => u.companies.map(c => ({ ...c, ownerEmail: u.email })));
  }, [data]);

  const filtered = useMemo(() => {
    let result = allCompanies;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(lower) || c.ownerEmail.toLowerCase().includes(lower)
      );
    }
    for (const f of activeFilters) {
      if (f.filter) result = result.filter(f.filter as (row: CompanyRow) => boolean);
    }
    return result;
  }, [allCompanies, search, activeFilters]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  async function handleUpdatePlan(companyId: string, plan: string, companyName: string) {
    try {
      await updatePlan({ variables: { companyId, plan } });
      showToast(`Updated ${companyName} to ${plan}`, 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update plan', 'error');
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="mt-0 mb-1 text-[1.4rem] font-bold text-[#0B2A4A]">Companies</h1>
        <p className="m-0 text-[0.88rem] text-[#64748b]">Manage plans across all companies.</p>
      </div>

      <Table<CompanyRow>
        label="Companies"
        headerList={HEADERS}
        dataList={paginated as TableDataRow<CompanyRow>[]}
        loading={loading}
        searchValue={search}
        handleSearch={setSearch}
        filters={[PLAN_FILTER]}
        activeFilters={activeFilters}
        setActiveFilters={setActiveFilters}
        mapData={(row) => ({
          ...row,
          plan: (
            <select
              value={row.plan as string}
              onChange={e => handleUpdatePlan(row.id as string, e.target.value, row.name as string)}
              style={{ width: 'auto', fontSize: '0.8rem', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 5 }}
            >
              <option value="starter">starter</option>
              <option value="pro">pro</option>
            </select>
          ),
        })}
        pagination={{
          totalItems: filtered.length,
          itemsPerPage: PAGE_SIZE,
          currentPage,
          onPageChange: setCurrentPage,
        }}
      />
    </>
  );
}
