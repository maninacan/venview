import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { showToast } from '@org/data';
import { PosMappingModal } from '../../components/modals/PosMappingModal';

const GET_SETTINGS = gql`
  query GetSettings($companyId: ID!) {
    company(id: $companyId) {
      id name phone contactName vendorCategory email joinCode plan
      members { userId email role }
      squareStatus { connected locationName locationId }
    }
  }
`;
const UPDATE_COMPANY = gql`
  mutation UpdateCompany($id: ID!, $input: UpdateCompanyInput!) {
    updateCompany(id: $id, input: $input) { id name phone contactName vendorCategory email }
  }
`;
const REMOVE_MEMBER = gql`
  mutation RemoveMember($companyId: ID!, $userId: ID!) {
    removeMember(companyId: $companyId, userId: $userId)
  }
`;
const LEAVE = gql`
  mutation LeaveCompany($companyId: ID!) {
    leaveCompany(companyId: $companyId)
  }
`;
const JOIN = gql`
  mutation JoinCompany($joinCode: String!) {
    joinCompany(joinCode: $joinCode) { id name }
  }
`;

const API_URL = (import.meta.env['VITE_API_URL'] as string) || 'http://localhost:3000';

export function SettingsPage() {
  const { companyId, company } = useCurrentCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [updateCompany] = useMutation(UPDATE_COMPANY);
  const [removeMember] = useMutation(REMOVE_MEMBER);
  const [leaveCompany] = useMutation(LEAVE);
  const [joinCompany] = useMutation(JOIN);

  const { data, loading, refetch } = useQuery(GET_SETTINGS, {
    variables: { companyId },
    skip: !companyId,
  });

  const [showPosMappings, setShowPosMappings] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: '', phone: '', contactName: '', vendorCategory: '', email: '' });
  const [savingCompany, setSavingCompany] = useState(false);
  const [connectingSquare, setConnectingSquare] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  const info = data?.company;
  const squareStatus = info?.squareStatus;
  const members = info?.members ?? [];

  // Prefill company form
  useEffect(() => {
    if (!info) return;
    setCompanyForm({
      name: info.name ?? '',
      phone: info.phone ?? '',
      contactName: info.contactName ?? '',
      vendorCategory: info.vendorCategory ?? '',
      email: info.email ?? '',
    });
  }, [info]);

  // Handle post-OAuth redirect
  useEffect(() => {
    const sq = searchParams.get('sq');
    if (sq === 'connected') {
      showToast('✅ Square connected successfully! Your locations are now available.', 'success', 6000);
      setSearchParams({});
      refetch();
    } else if (sq === 'error') {
      showToast('Square connection failed. Please try again.', 'error');
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refetch]);

  async function handleConnectSquare() {
    setConnectingSquare(true);
    try {
      const { supabase } = await import('@org/data');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_URL}/api/square/oauth/start?companyId=${companyId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await res.json() as { url?: string; error?: string };
      if (!result.url) throw new Error(result.error ?? 'Failed to get OAuth URL');
      window.location.href = result.url;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to connect Square', 'error');
      setConnectingSquare(false);
    }
  }

  async function handleDisconnectSquare() {
    if (!confirm('Disconnect Square? You will need to reconnect to sync sales.')) return;
    try {
      const { supabase } = await import('@org/data');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_URL}/api/square/disconnect/${companyId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Disconnect failed');
      showToast('Square disconnected.', 'info');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to disconnect', 'error');
    }
  }

  async function saveCompanyDetails() {
    setSavingCompany(true);
    try {
      await updateCompany({ variables: { id: companyId, input: companyForm } });
      showToast('Company details saved!', 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally { setSavingCompany(false); }
  }

  async function handleRemoveMember(userId: string, email: string) {
    if (!confirm(`Remove ${email} from the team?`)) return;
    try {
      await removeMember({ variables: { companyId, userId } });
      showToast('Member removed.', 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    }
  }

  async function handleJoinCode() {
    if (!joinCode.trim()) return;
    setJoiningCode(true);
    try {
      const { data: result } = await joinCompany({ variables: { joinCode: joinCode.trim().toUpperCase() } });
      showToast(`Joined ${result.joinCompany.name}!`, 'success');
      setJoinCode('');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid join code', 'error');
    } finally { setJoiningCode(false); }
  }

  if (loading) return <div className="card"><p style={{ color: 'var(--muted)' }}>Loading…</p></div>;

  return (
    <>
      {/* Square Integration */}
      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 4px', color: 'var(--vv-navy)' }}>Settings</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.86rem' }}>Manage your company and integrations.</p>
        </div>

        <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Integrations</p>

        <div className="border border-[rgba(11,42,74,0.12)] rounded-[10px] p-4 mt-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-black rounded-md flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect width="20" height="20" rx="3" fill="black"/>
                <rect x="5" y="5" width="10" height="10" rx="2" fill="white"/>
              </svg>
            </div>
            <div>
              <h3 className="m-0 mb-0.5 text-[0.95rem] font-semibold">Square POS</h3>
              <p className="m-0 text-[0.8rem] text-[#64748b]">Sync sales, locations &amp; labor automatically</p>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[0.74rem] font-semibold ml-auto ${squareStatus?.connected ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
              {squareStatus?.connected ? `✓ Connected${squareStatus.locationName ? ` — ${squareStatus.locationName}` : ''}` : 'Not Connected'}
            </span>
          </div>

          {squareStatus?.connected ? (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => setShowPosMappings(true)}>
                🗺 Manage POS Mappings
              </button>
              <button className="btn-danger-subtle" style={{ fontSize: '0.85rem' }} onClick={handleDisconnectSquare}>
                Disconnect Square
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <button className="btn-primary" onClick={handleConnectSquare} disabled={connectingSquare}>
                {connectingSquare && <span className="spinner" />}
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                  <rect x=".5" y=".5" width="5" height="5" rx=".8" fill="white"/>
                  <rect x="7.5" y=".5" width="5" height="5" rx=".8" fill="white"/>
                  <rect x=".5" y="7.5" width="5" height="5" rx=".8" fill="white"/>
                  <rect x="7.5" y="7.5" width="5" height="5" rx=".8" fill="white"/>
                </svg>
                Connect Square
              </button>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '8px 0 0' }}>
                Connect your Square account to automatically sync sales, locations, and labor.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Company Details */}
      <div className="card">
        <h3 style={{ margin: '0 0 16px', color: 'var(--vv-navy)' }}>Company Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          {[
            { key: 'name', label: 'Company Name' },
            { key: 'vendorCategory', label: 'Vendor Category' },
            { key: 'contactName', label: 'Contact Name' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
          ].map(f => (
            <div key={f.key} className="form-group">
              <label>{f.label}</label>
              <input
                type={f.key === 'email' ? 'email' : 'text'}
                value={companyForm[f.key as keyof typeof companyForm]}
                onChange={e => setCompanyForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={saveCompanyDetails} disabled={savingCompany}>
          {savingCompany && <span className="spinner" />} Save Details
        </button>
      </div>

      {/* Team Access */}
      <div className="card">
        <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Team Access</p>
        <p style={{ fontSize: '0.84rem', color: 'var(--muted)', margin: '0 0 16px' }}>
          Share events, inventory, and recipes with your team. Everyone in the same company sees the same data.
        </p>

        {/* Join code display */}
        {info?.joinCode && (
          <div style={{ background: '#f3f4f6', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'inline-block' }}>
            <p style={{ margin: '0 0 2px', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Your Join Code</p>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--vv-navy)' }}>{info.joinCode}</p>
            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--muted)' }}>Share this with your team</p>
          </div>
        )}

        {/* Member list */}
        {members.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: 16 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '0.75rem' }}>Email</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '0.75rem' }}>Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m: { userId: string; email: string; role: string }) => (
                <tr key={m.userId}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>{m.email}</td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', color: 'var(--muted)', textTransform: 'capitalize' }}>
                    {m.role === 'owner' ? '👑 Owner' : 'Member'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                    {m.role !== 'owner' && (
                      <button
                        className="btn-danger-subtle"
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                        onClick={() => handleRemoveMember(m.userId, m.email)}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add member by join code */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.8rem' }}>Add member via join code</label>
            <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Enter join code" style={{ width: 180, textTransform: 'uppercase' }} />
          </div>
          <button className="btn-primary" style={{ fontSize: '0.85rem' }} onClick={handleJoinCode} disabled={joiningCode}>
            {joiningCode && <span className="spinner" />} Add Member
          </button>
        </div>
      </div>

      {/* Plan info */}
      <div className="card">
        <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Subscription</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`inline-flex items-center text-[0.88rem] font-semibold px-[14px] py-1 rounded-full ${info?.plan === 'pro' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
            {info?.plan === 'pro' ? '⚡ Venview Pro' : '📋 Venview Starter'}
          </span>
          {info?.plan !== 'pro' && (
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              Includes 1 finalized event and basic profit summary.
            </span>
          )}
        </div>
      </div>

      {showPosMappings && companyId && (
        <PosMappingModal companyId={companyId} onClose={() => setShowPosMappings(false)} />
      )}
    </>
  );
}
