import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { CollapsibleCard } from '../../components/dashboard/CollapsibleCard';
import { ProfitSummaryCard } from '../../components/dashboard/ProfitSummaryCard';
import { showToast } from '@org/data';

const GET_REPORT = gql`
  query GetEventReport($id: ID!) {
    eventReport(id: $id) {
      event {
        id eventName eventDate endDate numDays isFinalized finalizedDate
        squareLocationId status eventType eventHost eventLocation
        coordinator time eventRating applicationDate notes
      }
      sales {
        grossSales netSales discounts refunds squareFees tips
        taxRate taxOverride totalCollected
      }
      expenses {
        healthDeptFee eventFee mileage mileageRate coordinatorFee
        posFee employeeBonus eventRunnerFees laborFees additionalFees
      }
      taxes { stateRate stateFoodTax taxDetail }
      summary {
        posFees cogs grossProfit totalExpenses netProfit
        tips stateFoodTax laborFees additionalFeesTotal mileageReimbursement
      }
      inventorySales { name quantitySold unitPrice totalCost }
      laborEntries { id employeeId name hours wage total }
      supplies { id name quantity unitCost total }
    }
  }
`;

const DELETE_EVENT = gql`
  mutation DeleteEvent($id: ID!) { deleteEvent(id: $id) }
`;

function fmt(v: number | null | undefined) { return `$${Number(v ?? 0).toFixed(2)}`; }
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateRange(start: string | null | undefined, numDays: number | null | undefined) {
  if (!start) return '';
  const s = formatDate(start);
  if (!numDays || numDays <= 1) return s;
  const end = new Date(start + 'T00:00:00');
  end.setDate(end.getDate() + numDays - 1);
  return `${s} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function EventDashboardPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { companyId } = useCurrentCompany();
  const navigate = useNavigate();

  const { data, loading, error, refetch } = useQuery(GET_REPORT, {
    variables: { id: eventId },
    skip: !eventId,
  });

  const [deleteEvent] = useMutation(DELETE_EVENT);

  const report = data?.eventReport;
  const event = report?.event;
  const sales = report?.sales ?? {};
  const expenses = report?.expenses ?? {};
  const summary = report?.summary ?? {};
  const taxes = report?.taxes ?? {};
  const inventorySales = report?.inventorySales ?? [];
  const laborEntries = report?.laborEntries ?? [];
  const supplies = report?.supplies ?? [];

  async function handleDelete() {
    if (!confirm(`Delete "${event?.eventName}"? This cannot be undone.`)) return;
    try {
      await deleteEvent({ variables: { id: eventId } });
      showToast('Event deleted', 'info');
      navigate(`/companies/${companyId}/events`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <span className="spinner spinner-dark" style={{ width: 28, height: 28, borderWidth: 3 }} />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="inline-error">
        <span>⚠️</span>
        <span>Could not load event. {error?.message}</span>
        <button className="inline-error-retry" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  // Meta chips
  const metaFields = [
    { label: 'Type', value: event?.eventType },
    { label: 'Host', value: event?.eventHost },
    { label: 'Coordinator', value: event?.coordinator },
    { label: 'Location', value: event?.eventLocation },
    { label: 'Status', value: event?.status },
    { label: 'Time', value: event?.time },
    { label: 'Rating', value: event?.eventRating },
    { label: 'Applied', value: event?.applicationDate ? formatDate(event.applicationDate) : null },
    { label: 'Notes', value: event?.notes },
  ].filter(f => f.value);

  return (
    <>
      {/* Dashboard header */}
      <div className="mb-4">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="text-[1.35rem] font-bold text-[#0B2A4A]">{event?.eventName}</div>
          {event?.isFinalized && <span className="finalized-badge-large">FINALIZED</span>}
        </div>
        <div className="text-[0.88rem] text-[#64748b] font-medium mb-1.5">{formatDateRange(event?.eventDate, event?.numDays)}</div>
        {event?.finalizedDate && (
          <div className="text-[0.78rem] text-[#64748b] mt-0.5">
            Finalized on: {formatDate(event.finalizedDate)}
          </div>
        )}

        {metaFields.length > 0 && (
          <div className="flex flex-wrap gap-[7px] mt-2">
            {metaFields.map(f => (
              <span key={f.label} className="inline-flex items-center gap-1 bg-[#f1f5f9] rounded-full px-2.5 py-[3px] text-[0.78rem]">
                <span className="text-[#64748b] font-medium">{f.label}</span>
                <span className="text-[#0B2A4A] font-semibold">{f.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-[7px] mb-[18px] mt-3.5">
          <div className="flex flex-wrap gap-2 items-center">
            <SyncSquareSalesButton eventId={eventId!} squareLocationId={event?.squareLocationId} onSynced={refetch} />
            <Link to={`/companies/${companyId}/events/${eventId}/edit`} className="btn-secondary"><i className="fa-solid fa-pen-to-square" /> Edit Event</Link>
            <Link to={`/companies/${companyId}/events/${eventId}/report`} className="btn-secondary"><i className="fa-solid fa-chart-bar" /> Post-Event Report</Link>
          </div>
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-[#f1f5f9] mt-0.5">
            <button className="btn-danger-subtle" onClick={handleDelete}><i className="fa-solid fa-trash" /> Delete Event</button>
          </div>
        </div>
      </div>

      {/* ── Dashboard Cards (matches original workflow order) ── */}

      {/* 1. Inventory Sales */}
      <CollapsibleCard title="Inventory Sales">
        {inventorySales.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: 0 }}>No Inventory Sales recorded. Pull Square Sales to populate.</p>
        ) : (
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead><tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Item</th>
                <th style={{ padding: '6px 8px' }}>Qty Sold</th>
                <th style={{ padding: '6px 8px' }}>Unit Cost</th>
                <th style={{ padding: '6px 8px' }}>Total COGS</th>
              </tr></thead>
              <tbody>
                {inventorySales.map((r: Record<string, unknown>, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: '6px 8px' }}>{r['name'] as string}</td>
                    <td style={{ padding: '6px 8px' }}>{Number(r['quantitySold'])}</td>
                    <td style={{ padding: '6px 8px' }}>{r['unitPrice'] != null ? fmt(r['unitPrice'] as number) : '—'}</td>
                    <td style={{ padding: '6px 8px' }}>{fmt(r['totalCost'] as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleCard>

      {/* 2. Truck Inventory */}
      <CollapsibleCard title="Truck Inventory">
        <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: 0 }}>Truck inventory tracking coming in Phase 5.</p>
      </CollapsibleCard>

      {/* 3. Manual Sales Entry */}
      <CollapsibleCard title="Manual Sales Entry">
        <ManualSalesForm eventId={eventId!} sales={sales} onSaved={refetch} />
      </CollapsibleCard>

      {/* 4. Discounts */}
      <CollapsibleCard title="Discounts">
        <AdjustmentForm eventId={eventId!} field="discounts" label="Discounts" currentValue={Number(sales.discounts ?? 0)} onSaved={refetch} />
      </CollapsibleCard>

      {/* 5. Labor */}
      <CollapsibleCard title="Labor" headerRight={
        <button className="btn-secondary ml-auto" onClick={() => showToast('Square labor sync coming in Phase 4', 'info')} style={{ fontSize: '0.8rem', padding: '3px 10px' }}>
          Pull Square Labor
        </button>
      }>
        <LaborSection eventId={eventId!} companyId={companyId!} laborEntries={laborEntries} onSaved={refetch} />
      </CollapsibleCard>

      {/* 6. Additional Fees */}
      <CollapsibleCard title="Additional Fees">
        <AdditionalFeesSection eventId={eventId!} fees={[]} onSaved={refetch} />
      </CollapsibleCard>

      {/* 7. Expenses */}
      <CollapsibleCard title="Expenses">
        <ExpensesForm eventId={eventId!} expenses={expenses} onSaved={refetch} />
      </CollapsibleCard>

      {/* 8. Tips */}
      <CollapsibleCard title="Tips">
        <AdjustmentForm eventId={eventId!} field="tips" label="Tips (pass-through)" currentValue={Number(sales.tips ?? 0)} onSaved={refetch} />
      </CollapsibleCard>

      {/* 9. Ingredient Costs / Recipe Matching */}
      <CollapsibleCard title="Ingredient Costs (Recipe Matching)">
        <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: 0 }}>Recipe matching coming in Phase 5. Connect recipes to auto-calculate COGS.</p>
      </CollapsibleCard>

      {/* 10. Custom Fields (if any) */}

      {/* 11. Event Profit Summary — open by default */}
      <ProfitSummaryCard
        eventId={eventId!}
        isFinalized={Boolean(event?.isFinalized)}
        sales={sales}
        expenses={expenses}
        summary={summary}
        taxes={taxes}
        onFinalized={refetch}
      />
    </>
  );
}

// ── Square Sales Sync button ──────────────────────────────────────────────────
function SyncSquareSalesButton({ eventId, squareLocationId, onSynced }: { eventId: string; squareLocationId?: string | null; onSynced: () => void }) {
  const SYNC = gql`
    mutation SyncSquareSales($eventId: ID!) {
      syncSquareSales(eventId: $eventId) { success message unmatchedCount }
    }
  `;
  const [sync] = useMutation(SYNC);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    if (!squareLocationId) {
      showToast('No Square location linked to this event. Edit the event to add one.', 'warning', 5000);
      return;
    }
    setSyncing(true);
    try {
      const { data } = await sync({ variables: { eventId } });
      const result = data.syncSquareSales;
      showToast(result.message, result.success ? 'success' : 'warning', 5000);
      if (result.success) onSynced();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button className="btn-primary" onClick={handleSync} disabled={syncing}>
      {syncing && <span className="spinner" />}
      <i className="fa-solid fa-arrows-rotate" /> Pull Square Sales
    </button>
  );
}

// ── Inline sub-forms ─────────────────────────────────────────────────────────

function ManualSalesForm({ eventId, sales, onSaved }: { eventId: string; sales: Record<string, unknown>; onSaved: () => void }) {
  const UPDATE = gql`
    mutation UpdateManualSales($eventId: ID!, $input: ManualSalesInput!) {
      updateManualSales(eventId: $eventId, input: $input) { grossSales netSales }
    }
  `;
  const [updateSales] = useMutation(UPDATE);
  const [vals, setVals] = useState({
    grossSales: String(sales.grossSales ?? '0'),
    refunds: String(sales.refunds ?? '0'),
    discounts: String(sales.discounts ?? '0'),
    totalCollected: String(sales.totalCollected ?? '0'),
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateSales({ variables: { eventId, input: { grossSales: +vals.grossSales, refunds: +vals.refunds, discounts: +vals.discounts, totalCollected: +vals.totalCollected } } });
      showToast('Sales saved!', 'success');
      onSaved();
    } catch (e) { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
      {(['grossSales', 'refunds', 'discounts', 'totalCollected'] as const).map(k => (
        <div key={k} className="form-group" style={{ margin: 0 }}>
          <label style={{ textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</label>
          <input type="number" step="0.01" value={vals[k]} onChange={e => setVals(v => ({ ...v, [k]: e.target.value }))} />
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
        <button className="btn-primary" onClick={save} disabled={saving} style={{ fontSize: '0.86rem' }}>
          {saving && <span className="spinner" />} <i className="fa-solid fa-floppy-disk" /> Save Sales Data
        </button>
      </div>
    </div>
  );
}

function AdjustmentForm({ eventId, field, label, currentValue, onSaved }: { eventId: string; field: 'tips' | 'discounts'; label: string; currentValue: number; onSaved: () => void }) {
  const UPDATE = gql`
    mutation UpdateAdjustments($eventId: ID!, $tips: Float, $posFee: Float) {
      updateAdjustments(eventId: $eventId, tips: $tips, posFee: $posFee)
    }
  `;
  const [update] = useMutation(UPDATE);
  const [val, setVal] = useState(String(currentValue));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await update({ variables: { eventId, [field]: +val } });
      showToast(`${label} saved!`, 'success');
      onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
      <div className="form-group" style={{ margin: 0, flex: 1, maxWidth: 200 }}>
        <label>{label}</label>
        <input type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)} />
      </div>
      <button className="btn-primary" onClick={save} disabled={saving} style={{ fontSize: '0.86rem', marginBottom: 0 }}>
        {saving && <span className="spinner" />} Save
      </button>
    </div>
  );
}

function LaborSection({ eventId, companyId, laborEntries, onSaved }: { eventId: string; companyId: string; laborEntries: Array<Record<string, unknown>>; onSaved: () => void }) {
  const CREATE = gql`
    mutation CreateLabor($eventId: ID!, $input: LaborEntryInput!) {
      createLaborEntry(eventId: $eventId, input: $input) { id name hours wage total }
    }
  `;
  const DELETE_LABOR = gql`
    mutation DeleteLabor($id: ID!) { deleteLaborEntry(id: $id) }
  `;
  const GET_EMPLOYEES = gql`
    query GetEmp($companyId: ID!) { employees(companyId: $companyId) { id name defaultWage } }
  `;

  const [create] = useMutation(CREATE);
  const [deleteLabor] = useMutation(DELETE_LABOR);
  const { data: empData } = useQuery(GET_EMPLOYEES, { variables: { companyId } });
  const employees = empData?.employees ?? [];

  const [form, setForm] = useState({ name: '', hours: '', wage: '' });
  const [saving, setSaving] = useState(false);

  async function addShift() {
    if (!form.name || !form.hours || !form.wage) { showToast('Fill in name, hours, and wage', 'error'); return; }
    setSaving(true);
    try {
      await create({ variables: { eventId, input: { name: form.name, hours: +form.hours, wage: +form.wage } } });
      setForm({ name: '', hours: '', wage: '' });
      showToast('Shift added', 'success');
      onSaved();
    } catch { showToast('Failed to add shift', 'error'); }
    finally { setSaving(false); }
  }

  async function removeShift(id: string) {
    await deleteLabor({ variables: { id } });
    onSaved();
  }

  function pickEmployee(emp: { name: string; defaultWage: number }) {
    setForm(f => ({ ...f, name: emp.name, wage: String(emp.defaultWage) }));
  }

  return (
    <div>
      {laborEntries.length > 0 && (
        <table className="w-full border-collapse text-[0.86rem] mt-2">
          <thead><tr>
            {['Name', 'Hours', 'Wage', 'Total', ''].map(h => (
              <th key={h} className="px-2 py-1.5 text-left text-[0.72rem] font-semibold text-[#64748b] uppercase tracking-[0.04em] border-b border-[#dde3f0]">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {laborEntries.map(r => (
              <tr key={r['id'] as string}>
                <td className="px-2 py-[7px] border-b border-[#f8fafc] align-middle">{r['name'] as string}</td>
                <td className="px-2 py-[7px] border-b border-[#f8fafc] align-middle">{Number(r['hours']).toFixed(2)}</td>
                <td className="px-2 py-[7px] border-b border-[#f8fafc] align-middle">${Number(r['wage']).toFixed(2)}/hr</td>
                <td className="px-2 py-[7px] border-b border-[#f8fafc] align-middle font-semibold">${Number(r['total']).toFixed(2)}</td>
                <td className="px-2 py-[7px] border-b border-[#f8fafc] align-middle"><button onClick={() => removeShift(r['id'] as string)} className="bg-transparent border-0 text-[#dc2626] cursor-pointer text-[0.85rem]"><i className="fa-solid fa-xmark" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: laborEntries.length > 0 ? 12 : 0, alignItems: 'flex-end' }}>
        {employees.length > 0 && (
          <div className="form-group" style={{ margin: 0 }}>
            <label>Quick pick</label>
            <select onChange={e => { const emp = employees.find((x: { id: string }) => x.id === e.target.value); if (emp) pickEmployee(emp); e.target.value = ''; }} style={{ width: 160 }}>
              <option value="">Employee…</option>
              {employees.map((emp: { id: string; name: string; defaultWage: number }) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group" style={{ margin: 0 }}>
          <label>Name</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: 140 }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Hours</label>
          <input type="number" step="0.25" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} style={{ width: 80 }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Wage/hr</label>
          <input type="number" step="0.01" value={form.wage} onChange={e => setForm(f => ({ ...f, wage: e.target.value }))} style={{ width: 90 }} />
        </div>
        <button className="btn-primary" onClick={addShift} disabled={saving} style={{ marginBottom: 0 }}>
          {saving && <span className="spinner" />} + Add Shift
        </button>
      </div>
    </div>
  );
}

function AdditionalFeesSection({ eventId, fees, onSaved }: { eventId: string; fees: Array<Record<string, unknown>>; onSaved: () => void }) {
  const CREATE = gql`
    mutation CreateFee($eventId: ID!, $input: AdditionalFeeInput!) {
      createAdditionalFee(eventId: $eventId, input: $input) { id label amount isDiscount }
    }
  `;
  const DELETE_FEE = gql`
    mutation DeleteFee($id: ID!) { deleteAdditionalFee(id: $id) }
  `;
  const [create] = useMutation(CREATE);
  const [deleteFee] = useMutation(DELETE_FEE);
  const [form, setForm] = useState({ label: '', amount: '', isDiscount: false });
  const [saving, setSaving] = useState(false);

  async function addFee() {
    if (!form.label || !form.amount) return;
    setSaving(true);
    try {
      await create({ variables: { eventId, input: { label: form.label, amount: +form.amount, isDiscount: form.isDiscount } } });
      setForm({ label: '', amount: '', isDiscount: false });
      onSaved();
    } catch { showToast('Failed', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      {fees.map(f => (
        <div key={f['id'] as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.86rem' }}>
          <span>{f['label'] as string}{f['isDiscount'] ? ' (discount)' : ''}</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <span>{f['isDiscount'] ? '-' : ''}${Number(f['amount']).toFixed(2)}</span>
            <button onClick={() => { deleteFee({ variables: { id: f['id'] } }); onSaved(); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}><i className="fa-solid fa-xmark" /></button>
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Label</label>
          <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={{ width: 160 }} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Amount</label>
          <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ width: 100 }} />
        </div>
        <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={form.isDiscount} onChange={e => setForm(f => ({ ...f, isDiscount: e.target.checked }))} id="feeDiscount" />
          <label htmlFor="feeDiscount" style={{ marginBottom: 0 }}>Discount</label>
        </div>
        <button className="btn-primary" onClick={addFee} disabled={saving} style={{ marginBottom: 0 }}>
          {saving && <span className="spinner" />} + Add
        </button>
      </div>
    </div>
  );
}

function ExpensesForm({ eventId, expenses, onSaved }: { eventId: string; expenses: Record<string, unknown>; onSaved: () => void }) {
  const UPDATE = gql`
    mutation UpdateExpenses($eventId: ID!, $input: ExpensesInput!) {
      updateExpenses(eventId: $eventId, input: $input) {
        healthDeptFee eventFee mileage mileageRate coordinatorFee posFee employeeBonus eventRunnerFees
      }
    }
  `;
  const [update] = useMutation(UPDATE);
  const fields = [
    { key: 'healthDeptFee', label: 'Health Dept Fee' },
    { key: 'eventFee', label: 'Event Fee' },
    { key: 'mileage', label: 'Mileage (miles)' },
    { key: 'mileageRate', label: 'Mileage Rate ($/mi)' },
    { key: 'coordinatorFee', label: 'Coordinator Fee' },
    { key: 'posFee', label: 'Manual POS Fee' },
    { key: 'employeeBonus', label: 'Employee Bonus' },
    { key: 'eventRunnerFees', label: 'Event Runner Fees' },
  ];
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, String(expenses[f.key] ?? '0')]))
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const input = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, +v]));
      await update({ variables: { eventId, input } });
      showToast('Expenses saved!', 'success');
      onSaved();
    } catch { showToast('Failed to save', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {fields.map(f => (
          <div key={f.key} className="form-group" style={{ margin: 0 }}>
            <label>{f.label}</label>
            <input type="number" step="0.01" value={vals[f.key]} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} />
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: 12, fontSize: '0.86rem' }}>
        {saving && <span className="spinner" />} <i className="fa-solid fa-floppy-disk" /> Save Expenses
      </button>
    </div>
  );
}
