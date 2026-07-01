import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Company {
  id: string;
  name: string;
  vendorCategory?: string | null;
  plan: string;
  members?: Array<unknown>;
}

interface Props {
  company: Company;
  /** The user has requested to join this company and is awaiting owner approval. */
  pending?: boolean;
}

export function CompanyCard({ company, pending }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation('companies');

  // Pending: the user isn't a member yet, so the card is non-interactive and
  // visually distinct — dashed border, reduced opacity, and an amber status badge.
  if (pending) {
    return (
      <div
        className="bg-white border-2 border-dashed border-[rgba(11,42,74,0.22)] rounded-[14px] p-[22px] relative min-h-[150px] flex flex-col opacity-70"
        aria-label={t('pending.aria', '{{name}} — awaiting approval', { name: company.name })}
      >
        <div className="text-[1.05rem] font-bold text-[#0B2A4A] mb-[5px]">{company.name}</div>
        {company.vendorCategory && (
          <div className="text-[0.82rem] text-[#64748b] mb-1">{company.vendorCategory}</div>
        )}
        <div className="text-[0.78rem] text-[#94a3b8] mb-3">
          {t('pending.hint', 'Your request to join is pending the owner’s approval.')}
        </div>
        <div className="mt-auto">
          <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold px-[9px] py-[3px] rounded-full bg-[#fef3c7] text-[#92400e]">
            ⏳ {t('pending.badge', 'Awaiting approval')}
          </span>
        </div>
      </div>
    );
  }

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
