import { CollapsibleCard } from './CollapsibleCard';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { showToast } from '../../hooks/useToast';
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
      <div className="profit-summary">
        {/* Revenue */}
        <div className="section-title">Revenue</div>
        <div className="ledger-row"><span className="ledger-label">Gross Sales</span><span className="ledger-amount">{fmt(sales.grossSales)}</span></div>
        <div className="ledger-row"><span className="ledger-label">Returns</span><span className="ledger-amount">-{fmt(sales.refunds)}</span></div>
        <div className="ledger-row"><span className="ledger-label">Discounts</span><span className="ledger-amount">-{fmt(sales.discounts)}</span></div>
        <div className="ledger-row total-row"><span className="ledger-label">Net Sales</span><span className="ledger-amount">{fmt(sales.netSales)}</span></div>
        <div className="section-divider" />

        {/* COGS */}
        <div className="section-title">Cost of Goods Sold (COGS) - Supply Fees</div>
        <div className="ledger-row"><span className="ledger-label">Ingredient Costs</span><span className="ledger-amount">-{fmt(summary.cogs)}</span></div>
        <div className="section-divider" />
        <div className={`ledger-row total-row ${grossProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
          <span className="ledger-label">Gross Profit</span><span className="ledger-amount">{fmt(grossProfit)}</span>
        </div>
        <div className="section-divider" />

        {/* Operating Expenses */}
        <div className="section-title">Operating Expenses</div>
        <div className="ledger-row"><span className="ledger-label">Health Dept Fee</span><span className="ledger-amount">-{fmt(expenses.healthDeptFee)}</span></div>
        <div className="ledger-row"><span className="ledger-label">Event Fee</span><span className="ledger-amount">-{fmt(expenses.eventFee)}</span></div>
        <div className="ledger-row"><span className="ledger-label">Additional Fees</span><span className="ledger-amount">-{fmt(summary.additionalFeesTotal)}</span></div>
        <div className="ledger-row"><span className="ledger-label">Mileage Reimbursement</span><span className="ledger-amount">-{fmt(summary.mileageReimbursement)}</span></div>
        <div className="ledger-row"><span className="ledger-label">Employee Bonus</span><span className="ledger-amount">-{fmt(expenses.employeeBonus)}</span></div>
        <div className="ledger-row"><span className="ledger-label">Event Runner Fees</span><span className="ledger-amount">-{fmt(expenses.eventRunnerFees)}</span></div>
        <div className="ledger-row"><span className="ledger-label">Labor Fees</span><span className="ledger-amount">-{fmt(summary.laborFees)}</span></div>
        <div className="ledger-row"><span className="ledger-label">Coordinator Fee</span><span className="ledger-amount">-{fmt(expenses.coordinatorFee)}</span></div>
        <div className="ledger-row"><span className="ledger-label">POS Fees</span><span className="ledger-amount">-{fmt(summary.posFees)}</span></div>
        <div className="section-divider" />
        <div className="ledger-row total-row"><span className="ledger-label">Total Operating Expenses</span><span className="ledger-amount">-{fmt(summary.totalExpenses)}</span></div>
        <div className="section-divider" />
        <div className={`ledger-row final-row ${netProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
          <span className="ledger-label">Net Profit</span><span className="ledger-amount">{fmt(netProfit)}</span>
        </div>

        {/* Labor warning */}
        {Number(summary.laborFees ?? 0) === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 6, padding: '8px 12px', margin: '8px 0', fontSize: '0.85rem', color: '#92400e' }}>
            <span>⚠️</span>
            <span>Labor not yet entered — profit may change. Add labor in the Labor card above.</span>
          </div>
        )}

        <div className="section-divider" />

        {/* Finalize button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div className="section-title" style={{ margin: 0 }}>For Your Records</div>
          {!isFinalized && (
            <button
              className="btn-primary"
              style={{ fontSize: '0.78rem', padding: '3px 10px' }}
              onClick={handleFinalize}
              disabled={loading}
            >
              {loading && <span className="spinner" />}
              ✅ Finalize Event
            </button>
          )}
        </div>
        <div className="ledger-row ledger-row-info">
          <span className="ledger-label">Tips (pass-through to staff)</span>
          <span className="ledger-amount">{fmt(summary.tips)}</span>
        </div>
        <div className="ledger-row ledger-row-info">
          <span className="ledger-label">{salesTaxLabel}</span>
          <span className="ledger-amount">{fmt(summary.stateFoodTax)}</span>
        </div>
        <p className="ledger-note">ⓘ Income taxes are calculated annually — consult your accountant.</p>
      </div>
    </CollapsibleCard>
  );
}
