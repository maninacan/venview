import React from 'react';
import { CollapsibleCard } from './CollapsibleCard';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { showToast } from '@org/data';
import { useSpinner } from '../../hooks/useSpinner';

const FINALIZE = gql`
  mutation FinalizeEvent($id: ID!) {
    finalizeEvent(id: $id) { id isFinalized finalizedDate }
  }
`;

interface SalesSummary {
  grossSales?: number | null;
  netSales?: number | null;
  refunds?: number | null;
  discounts?: number | null;
  squareFees?: number | null;
  tips?: number | null;
}

interface ExpenseSummary {
  healthDeptFee?: number | null;
  eventFee?: number | null;
  laborFees?: number | null;
  coordinatorFee?: number | null;
  additionalFees?: number | null;
  employeeBonus?: number | null;
  eventRunnerFees?: number | null;
  mileage?: number | null;
  mileageRate?: number | null;
}

interface ReportSummary {
  posFees?: number | null;
  cogs?: number | null;
  grossProfit?: number | null;
  totalExpenses?: number | null;
  netProfit?: number | null;
  tips?: number | null;
  stateFoodTax?: number | null;
  laborFees?: number | null;
  additionalFeesTotal?: number | null;
  mileageReimbursement?: number | null;
}

interface TaxInfo {
  stateRate?: number | null;
  stateFoodTax?: number | null;
  taxDetail?: { state?: string } | null;
}

interface Props {
  eventId: string;
  isFinalized: boolean;
  sales: SalesSummary;
  expenses: ExpenseSummary;
  summary: ReportSummary;
  taxes: TaxInfo;
  onFinalized: () => void;
}

const fmt = (v: number | null | undefined) => `$${Number(v ?? 0).toFixed(2)}`;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[#64748b] mt-3 mb-1.5">{children}</div>;
}

function Divider() {
  return <div className="border-t border-[#dde3f0] my-[7px]" />;
}

function LedgerRow({ label, value, bold, final, info, profit }: {
  label: string; value: string;
  bold?: boolean; final?: boolean; info?: boolean;
  profit?: 'positive' | 'negative';
}) {
  const base = 'flex justify-between py-[3px] border-b border-[#f8fafc]';
  const labelCls = [
    info ? 'text-[#64748b] text-[0.82rem]' : 'text-[#222]',
    bold ? 'font-bold' : '',
    final ? 'text-[1.1rem] font-extrabold' : '',
  ].filter(Boolean).join(' ');
  const valueCls = [
    'tabular-nums',
    info ? 'text-[#64748b] text-[0.82rem]' : '',
    bold ? 'font-bold' : 'font-medium',
    final ? 'text-[1.1rem] font-extrabold' : '',
    profit === 'positive' ? 'text-[#166534]' : profit === 'negative' ? 'text-[#991b1b]' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={base}>
      <span className={labelCls}>{label}</span>
      <span className={valueCls}>{value}</span>
    </div>
  );
}

export function ProfitSummaryCard({ eventId, isFinalized, sales, expenses, summary, taxes, onFinalized }: Props) {
  const [finalizeEvent] = useMutation(FINALIZE);
  const { loading, withSpinner } = useSpinner();

  const netProfit = Number(summary.netProfit ?? 0);
  const grossProfit = Number(summary.grossProfit ?? 0);

  async function handleFinalize() {
    await withSpinner(async () => {
      try {
        await finalizeEvent({ variables: { id: eventId } });
        showToast('Event finalized!', 'success');
        onFinalized();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to finalize';
        if (msg.includes('FINALIZE_LIMIT_REACHED')) {
          showToast('Upgrade to Pro to finalize more than 1 event.', 'warning', 5000);
        } else {
          showToast(msg, 'error');
        }
      }
    });
  }

  const stateRate = Number(taxes?.stateRate ?? 0);
  const stateRatePct = (stateRate * 100).toFixed(2);
  const stateName = taxes?.taxDetail?.state ?? '';
  const salesTaxLabel = stateName
    ? `Sales Tax Collected — Remit to ${stateName} (${stateRatePct}%)`
    : `Sales Tax Collected — Remit to State (${stateRatePct}%)`;

  return (
    <CollapsibleCard title="Event Profit Summary" defaultOpen={true}>
      <div className="text-[0.88rem]">
        {/* Revenue */}
        <SectionTitle>Revenue</SectionTitle>
        <LedgerRow label="Gross Sales" value={fmt(sales.grossSales)} />
        <LedgerRow label="Returns" value={`-${fmt(sales.refunds)}`} />
        <LedgerRow label="Discounts" value={`-${fmt(sales.discounts)}`} />
        <LedgerRow label="Net Sales" value={fmt(sales.netSales)} bold />
        <Divider />

        {/* COGS */}
        <SectionTitle>Cost of Goods Sold (COGS) - Supply Fees</SectionTitle>
        <LedgerRow label="Ingredient Costs" value={`-${fmt(summary.cogs)}`} />
        <Divider />
        <LedgerRow label="Gross Profit" value={fmt(grossProfit)} bold profit={grossProfit >= 0 ? 'positive' : 'negative'} />
        <Divider />

        {/* Operating Expenses */}
        <SectionTitle>Operating Expenses</SectionTitle>
        <LedgerRow label="Health Dept Fee" value={`-${fmt(expenses.healthDeptFee)}`} />
        <LedgerRow label="Event Fee" value={`-${fmt(expenses.eventFee)}`} />
        <LedgerRow label="Additional Fees" value={`-${fmt(summary.additionalFeesTotal)}`} />
        <LedgerRow label="Mileage Reimbursement" value={`-${fmt(summary.mileageReimbursement)}`} />
        <LedgerRow label="Employee Bonus" value={`-${fmt(expenses.employeeBonus)}`} />
        <LedgerRow label="Event Runner Fees" value={`-${fmt(expenses.eventRunnerFees)}`} />
        <LedgerRow label="Labor Fees" value={`-${fmt(summary.laborFees)}`} />
        <LedgerRow label="Coordinator Fee" value={`-${fmt(expenses.coordinatorFee)}`} />
        <LedgerRow label="POS Fees" value={`-${fmt(summary.posFees)}`} />
        <Divider />
        <LedgerRow label="Total Operating Expenses" value={`-${fmt(summary.totalExpenses)}`} bold />
        <Divider />
        <LedgerRow label="Net Profit" value={fmt(netProfit)} final profit={netProfit >= 0 ? 'positive' : 'negative'} />

        {/* Labor warning */}
        {Number(summary.laborFees ?? 0) === 0 && (
          <div className="flex items-center gap-2 bg-[#fffbeb] border border-[#f59e0b] rounded-md px-3 py-2 my-2 text-[0.85rem] text-[#92400e]">
            <span>⚠️</span>
            <span>Labor not yet entered — profit may change. Add labor in the Labor card above.</span>
          </div>
        )}

        <Divider />

        {/* For Your Records */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[#64748b]">For Your Records</div>
          {!isFinalized && (
            <button
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '3px 10px' }}
              onClick={handleFinalize}
              disabled={loading}
            >
              {loading && <span className="spinner" />}
              <span>✅ Finalize Event</span>
            </button>
          )}
        </div>
        <LedgerRow label="Tips (pass-through to staff)" value={fmt(summary.tips)} info />
        <LedgerRow label={salesTaxLabel} value={fmt(summary.stateFoodTax)} info />
        <p className="text-[0.76rem] text-[#64748b] mt-[7px]">ⓘ Income taxes are calculated annually — consult your accountant.</p>
      </div>
    </CollapsibleCard>
  );
}
