import { useNavigate } from 'react-router-dom';

interface Company {
  id: string;
  name: string;
  vendorCategory?: string | null;
  plan: string;
  members?: Array<unknown>;
}

interface Props {
  company: Company;
}

export function CompanyCard({ company }: Props) {
  const navigate = useNavigate();

  return (
    <div
      className="company-card"
      onClick={() => navigate(`/companies/${company.id}/events`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/companies/${company.id}/events`)}
    >
      <div className="company-card-name">{company.name}</div>
      {company.vendorCategory && (
        <div className="company-card-category">{company.vendorCategory}</div>
      )}
      <div className="company-card-meta">
        <span className={`company-card-plan ${company.plan === 'pro' ? 'plan-pro' : 'plan-starter'}`}>
          {company.plan === 'pro' ? '⚡ Pro' : 'Starter'}
        </span>
        {(company.members?.length ?? 0) > 1 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            👥 {company.members?.length} members
          </span>
        )}
      </div>
    </div>
  );
}

export function CompanyCardSkeleton() {
  return <div className="company-card-skeleton" />;
}
