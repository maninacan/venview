import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useQuery as useAuthQuery } from '@apollo/client/react';
import { showToast } from '../../hooks/useToast';

const GET_ME = gql`
  query GetMeForAdmin { me { id isAdmin } }
`;
const GET_ADMIN_USERS = gql`
  query GetAdminUsers {
    adminUsers {
      userId email companyCount
      companies { id name plan memberCount }
    }
  }
`;
const UPDATE_PLAN = gql`
  mutation UpdateCompanyPlan($companyId: ID!, $plan: String!) {
    updateCompanyPlan(companyId: $companyId, plan: $plan) { id name plan }
  }
`;

interface AdminCompany { id: string; name: string; plan: string; memberCount: number; }
interface AdminUser { userId: string; email: string; companyCount: number; companies: AdminCompany[]; }

export function AdminPage() {
  const { data: meData } = useAuthQuery(GET_ME);
  const { data, loading, refetch } = useQuery(GET_ADMIN_USERS, { skip: !meData?.me?.isAdmin });
  const [updatePlan] = useMutation(UPDATE_PLAN);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  const isAdmin = meData?.me?.isAdmin;
  const users: AdminUser[] = data?.adminUsers ?? [];

  const filtered = users.filter(u => {
    const matchSearch = !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.userId.includes(search);
    const matchPlan = !planFilter || u.companies.some(c => c.plan === planFilter);
    return matchSearch && matchPlan;
  });

  const totalPro = users.flatMap(u => u.companies).filter(c => c.plan === 'pro').length;
  const totalStarter = users.flatMap(u => u.companies).filter(c => c.plan === 'starter').length;

  async function handleUpdatePlan(companyId: string, plan: string, companyName: string) {
    try {
      await updatePlan({ variables: { companyId, plan } });
      showToast(`Updated ${companyName} to ${plan}`, 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update plan', 'error');
    }
  }

  if (!isAdmin) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</div>
        <h2 style={{ color: 'var(--vv-navy)' }}>Admin Only</h2>
        <p style={{ color: 'var(--muted)' }}>You don't have access to the admin panel.</p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 4px', color: 'var(--vv-navy)' }}>⚙ Admin Panel</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.86rem' }}>Manage user plans and view account activity.</p>
        </div>

        {/* Stats */}
        <div className="admin-stats">
          <div className="admin-stat-chip">
            <strong>{users.length}</strong> users
          </div>
          <div className="admin-stat-chip">
            <strong>{users.flatMap(u => u.companies).length}</strong> companies
          </div>
          <div className="admin-stat-chip" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
            <strong>{totalPro}</strong> Pro
          </div>
          <div className="admin-stat-chip">
            <strong>{totalStarter}</strong> Starter
          </div>
        </div>

        {/* Toolbar */}
        <div className="admin-toolbar">
          <input
            type="text"
            placeholder="Search by email or user ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
            <option value="">All Plans</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
          </select>
          <button className="btn-secondary" onClick={() => refetch()}>↺ Refresh</button>
        </div>

        {loading && <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Loading users…</p>}

        {!loading && filtered.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', padding: '16px 0' }}>No users found.</p>
        )}

        <div className="admin-table-wrap">
          {filtered.map(user => (
            <div key={user.userId} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {user.email || <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{user.userId.slice(0, 12)}…</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                    {user.companyCount} compan{user.companyCount !== 1 ? 'ies' : 'y'}
                  </div>
                </div>
              </div>

              {user.companies.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {user.companies.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 6, padding: '7px 10px' }}>
                      <span style={{ flex: 1, fontSize: '0.86rem', fontWeight: 500 }}>{c.name}</span>
                      <span className={`admin-plan-badge ${c.plan === 'pro' ? 'badge-pro' : 'badge-starter'}`}>
                        {c.plan}
                      </span>
                      <select
                        value={c.plan}
                        onChange={e => handleUpdatePlan(c.id, e.target.value, c.name)}
                        style={{ fontSize: '0.8rem', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 5 }}
                      >
                        <option value="starter">starter</option>
                        <option value="pro">pro</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
