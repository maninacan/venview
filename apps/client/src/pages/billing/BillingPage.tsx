import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { useBilling } from '../../hooks/useBilling';
import { showToast } from '@org/data';

const GET_BILLING = gql`
  query GetBilling($companyId: ID!) {
    company(id: $companyId) {
      id plan subscriptionStatus currentPeriodEnd
    }
  }
`;

interface BillingCompany {
  id: string;
  plan: string;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: string | null;
}

const PRO_FEATURES: Array<{ title: string; detail: string }> = [
  { title: 'Post-Event Reports', detail: 'Full profit & loss breakdown, shareable and printable' },
  { title: 'Unlimited finalized events', detail: 'Track every market, festival, and pop-up you run' },
  { title: 'PDF export', detail: 'Download branded reports for your records or accountant' },
  { title: 'Full event history', detail: 'Compare events over time to find your most profitable markets' },
  { title: 'Square POS sync', detail: 'Pull real sales data — fees, refunds, and discounts included' },
  { title: 'Custom form templates', detail: 'Design event forms that match exactly how you work' },
];

export function BillingPage() {
  const { companyId } = useCurrentCompany();
  const { busy, startCheckout, openPortal } = useBilling();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, loading, refetch } = useQuery(GET_BILLING, {
    variables: { companyId },
    skip: !companyId,
  });
  const company = data?.company as BillingCompany | undefined;
  const isPro = company?.plan === 'pro';

  // Handle the return from Stripe Checkout.
  useEffect(() => {
    const billing = searchParams.get('billing');
    if (!billing) return;
    if (billing === 'success') {
      showToast('Payment received — activating Venview Pro…', 'success', 5000);
      // The webhook may land a moment after redirect; refetch shortly after.
      setTimeout(() => refetch(), 1500);
    } else if (billing === 'cancelled') {
      showToast('Checkout cancelled.', 'info');
    }
    searchParams.delete('billing');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, refetch]);

  const renewalDate = company?.currentPeriodEnd
    ? new Date(company.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const featureCheck = 'w-[19px] h-[19px] rounded-full flex items-center justify-center text-[0.7rem] font-bold flex-shrink-0 mt-0.5 bg-[#dbeafe] text-[#1d4ed8]';

  return (
    <>
      <div className="card">
        <div className="mb-4">
          <h2 className="mt-0 mb-1 text-[#0B2A4A]">💳 Billing</h2>
          <p className="text-[#64748b] text-[0.86rem] m-0">Manage your Venview subscription and payment details.</p>
        </div>

        {loading && <p className="text-[#64748b] text-[0.88rem]">Loading…</p>}

        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className={`inline-flex items-center gap-1.5 text-[0.9rem] font-semibold px-[14px] py-1 rounded-full ${isPro ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
              {isPro ? <><i className="fa-solid fa-bolt" /> Venview Pro</> : <><i className="fa-solid fa-clipboard-list" /> Venview Starter</>}
            </span>
            {isPro && company?.subscriptionStatus && company.subscriptionStatus !== 'active' && (
              <span className="text-[0.82rem] font-semibold text-[#b45309] capitalize">{company.subscriptionStatus.replace(/_/g, ' ')}</span>
            )}
            {isPro && renewalDate && (
              <span className="text-[0.82rem] text-[#64748b]">
                {company?.subscriptionStatus === 'canceled' ? 'Access ends' : 'Renews'} {renewalDate}
              </span>
            )}
          </div>
        )}
      </div>

      {!loading && isPro && (
        <div className="card">
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>Manage subscription</p>
          <p className="text-[#64748b] text-[0.86rem] mt-0 mb-3.5">Update your payment method, view invoices, or cancel your plan through our secure billing portal.</p>
          <button className="btn-primary" disabled={!companyId || busy} onClick={() => companyId && openPortal(companyId)}>
            {busy && <span className="spinner" />} <span><i className="fa-solid fa-arrow-up-right-from-square" /> Manage subscription</span>
          </button>
        </div>
      )}

      {!loading && !isPro && (
        <div className="card">
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Upgrade to Venview Pro</p>
          <p className="text-[#0B2A4A] text-[0.95rem] font-semibold mt-0 mb-1">See every event's true profit.</p>
          <p className="text-[#64748b] text-[0.86rem] mt-0 mb-4">Track trends over time and make smarter decisions — faster.</p>

          <ul className="list-none p-0 m-0 mb-5 flex flex-col gap-[9px]">
            {PRO_FEATURES.map(f => (
              <li key={f.title} className="flex gap-[11px] items-start">
                <span className={featureCheck}>✓</span>
                <div className="text-[0.86rem]">
                  <strong className="block font-semibold mb-[1px]">{f.title}</strong>
                  <span className="text-[#64748b] text-[0.82rem]">{f.detail}</span>
                </div>
              </li>
            ))}
          </ul>

          <button className="btn-primary" disabled={!companyId || busy} onClick={() => companyId && startCheckout(companyId)}>
            {busy && <span className="spinner" />} <span><i className="fa-solid fa-bolt" /> Upgrade to Pro</span>
          </button>
          <p className="text-[0.76rem] text-[#64748b] mt-2.5 mb-0">Secure checkout powered by Stripe · cancel anytime.</p>
        </div>
      )}
    </>
  );
}
