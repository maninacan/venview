import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { CompanyCard, CompanyCardSkeleton } from '../../components/companies/CompanyCard';
import { WelcomeModal } from '../../components/modals/WelcomeModal';
import { showToast } from '@org/data';

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
      <div className="mb-2">
        <h1 className="text-[1.5rem] font-bold text-[#0B2A4A] mt-0 mb-1">
          {data?.me ? 'Welcome back!' : 'My Companies'}
        </h1>
        <p className="text-[#64748b] text-[0.9rem] m-0">Select a company to manage its events, inventory, and recipes.</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-[18px] mt-6">
        {loading && [0, 1, 2].map(i => <CompanyCardSkeleton key={i} />)}

        {!loading && companies.map((c: Parameters<typeof CompanyCard>[0]['company']) => (
          <CompanyCard key={c.id} company={c} />
        ))}

        <Link
          to="/companies/new"
          className="bg-[#f8fafc] border-2 border-dashed border-[rgba(11,42,74,0.12)] rounded-[14px] p-[22px] min-h-[150px] flex flex-col items-center justify-center gap-2 cursor-pointer no-underline text-[#64748b] font-semibold text-[0.9rem] transition-[border-color,background,color] hover:border-[#0B2A4A] hover:bg-[#eff6ff] hover:text-[#0B2A4A]"
        >
          <span className="text-[1.8rem] opacity-40">+</span>
          Create a new company
        </Link>
      </div>

      <div className="flex gap-3 mt-7 flex-wrap">
        {!showJoinForm ? (
          <button className="btn-secondary" onClick={() => setShowJoinForm(true)}>
            <i className="fa-solid fa-link" /> Join a company
          </button>
        ) : (
          <form onSubmit={handleJoin} className="flex gap-2 items-center flex-wrap">
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
