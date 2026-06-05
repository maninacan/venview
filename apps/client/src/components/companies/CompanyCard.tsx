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
      className="bg-white border-2 border-[rgba(11,42,74,0.12)] rounded-[14px] p-[22px] cursor-pointer transition-[border-color,box-shadow,transform] duration-200 relative min-h-[150px] flex flex-col hover:border-[#0B2A4A] hover:shadow-[0_12px_30px_rgba(11,42,74,0.12)] hover:-translate-y-0.5"
      onClick={() => navigate(`/companies/${company.id}/events`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && navigate(`/companies/${company.id}/events`)}
    >
      <div className="text-[1.05rem] font-bold text-[#0B2A4A] mb-[5px]">{company.name}</div>
      {company.vendorCategory && (
        <div className="text-[0.82rem] text-[#64748b] mb-3">{company.vendorCategory}</div>
      )}
      <div className="mt-auto flex items-center justify-between">
        <span className={`inline-flex items-center text-[0.75rem] font-semibold px-[9px] py-[2px] rounded-full ${company.plan === 'pro' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
          {company.plan === 'pro' ? '⚡ Pro' : 'Starter'}
        </span>
        {(company.members?.length ?? 0) > 1 && (
          <span className="text-[0.78rem] text-[#64748b]">
            👥 {company.members?.length} members
          </span>
        )}
      </div>
    </div>
  );
}

export function CompanyCardSkeleton() {
  return (
    <div
      className="bg-[#e2e8f0] rounded-[14px] min-h-[150px]"
      style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
    />
  );
}
