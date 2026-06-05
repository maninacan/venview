import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { CompanyCard, CompanyCardSkeleton } from '../../components/companies/CompanyCard';
import { WelcomeModal } from '../../components/modals/WelcomeModal';
import { showToast } from '../../hooks/useToast';

const GET_MY_COMPANIES = gql`
  query GetMyCompanies {
    me {
      id
      companies {
        id name vendorCategory plan
        members { userId role }
      }
    }
  }
`;

const JOIN_COMPANY = gql`
  mutation JoinCompany($joinCode: String!) {
    joinCompany(joinCode: $joinCode) { id name }
  }
`;

export function CompaniesPage() {
  const [joinCode, setJoinCode] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joining, setJoining] = useState(false);

  const { data, loading, refetch } = useQuery(GET_MY_COMPANIES);
  const [joinCompany] = useMutation(JOIN_COMPANY);
  const [showWelcome, setShowWelcome] = useState(false);
  const [firstCompanyId, setFirstCompanyId] = useState('');

  const companies = data?.me?.companies ?? [];

  // Show welcome modal on first login (per-user localStorage flag)
  useEffect(() => {
    if (!data?.me?.id) return;
    const key = `venview_welcome_seen_${data.me.id}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, 'true');
      setShowWelcome(true);
      if (companies.length > 0) setFirstCompanyId(companies[0].id);
    }
  }, [data?.me?.id, companies.length]); // eslint-disable-line

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const { data: result } = await joinCompany({ variables: { joinCode: joinCode.trim().toUpperCase() } });
      showToast(`Joined ${result.joinCompany.name}!`, 'success');
      setJoinCode('');
      setShowJoinForm(false);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid join code', 'error');
    } finally {
      setJoining(false);
    }
  }

  return (
    <>
      <div className="companies-page-header">
        <h1>
          {data?.me ? `Welcome back!` : 'My Companies'}
        </h1>
        <p>Select a company to manage its events, inventory, and recipes.</p>
      </div>

      <div className="companies-grid">
        {loading && [0, 1, 2].map(i => <CompanyCardSkeleton key={i} />)}

        {!loading && companies.map((c: Parameters<typeof CompanyCard>[0]['company']) => (
          <CompanyCard key={c.id} company={c} />
        ))}

        {/* Add company card */}
        <Link to="/companies/new" className="add-company-card">
          <span className="add-company-icon">+</span>
          Create a new company
        </Link>
      </div>

      <div className="companies-actions">
        {!showJoinForm ? (
          <button className="btn-secondary" onClick={() => setShowJoinForm(true)}>
            🔗 Join a company
          </button>
        ) : (
          <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Enter join code (e.g. ABC123)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              style={{ width: 220 }}
              autoFocus
            />
            <button type="submit" className="btn-primary" disabled={joining}>
              {joining && <span className="spinner" />} Join
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowJoinForm(false)}>Cancel</button>
          </form>
        )}
      </div>

      {showWelcome && (
        <WelcomeModal
          companyId={firstCompanyId || (companies[0]?.id ?? '')}
          onClose={() => setShowWelcome(false)}
        />
      )}
    </>
  );
}
