import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { showToast } from '@org/data';

const GET_REPORT = gql`
  query GetPostEventReport($id: ID!) {
    eventReport(id: $id) {
      event {
        id eventName eventDate endDate numDays isFinalized finalizedDate
        posLocationId status eventType eventHost eventLocation
        coordinator time eventRating applicationDate notes customFields
      }
      sales {
        grossSales netSales discounts refunds squareFees tips
        taxRate totalCollected
      }
      expenses {
        healthDeptFee eventFee mileage mileageRate coordinatorFee
        posFee employeeBonus eventRunnerFees laborFees additionalFees
      }
      taxes { stateRate localRate stateTax localTax taxCollected jurisdiction }
      summary {
        posFees cogs grossProfit totalExpenses netProfit
        tips stateFoodTax laborFees additionalFeesTotal mileageReimbursement
      }
      inventorySales { name quantitySold unitPrice totalCost }
      laborEntries { id name hours wage total }
      supplies { id name quantity unitCost total }
    }
  }
`;

function fmt(v: number | null | undefined) { return `$${Number(v ?? 0).toFixed(2)}`; }
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function formatDateRange(start: string | null | undefined, numDays: number | null | undefined) {
  if (!start) return '';
  const s = formatDate(start);
  if (!numDays || numDays <= 1) return s;
  const end = new Date(start + 'T00:00:00');
  end.setDate(end.getDate() + numDays - 1);
  return `${s} – ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9', fontWeight: bold ? 700 : undefined, color }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', margin: '18px 0 6px' }}>
      {title}
    </div>
  );
}

export function PostEventReportPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { companyId } = useCurrentCompany();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery(GET_REPORT, {
    variables: { id: eventId },
    skip: !eventId,
  });

  const report = data?.eventReport;
  const event = report?.event;
  const sales = report?.sales ?? {};
  const expenses = report?.expenses ?? {};
  const summary = report?.summary ?? {};
  const taxes = report?.taxes ?? {};
  const laborEntries = report?.laborEntries ?? [];
  const supplies = report?.supplies ?? [];
  const inventorySales = report?.inventorySales ?? [];

  async function downloadPDF() {
    if (!report) return;
    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      // pdfmake 0.3.x exports the vfs object directly; older builds nest it
      // under `.pdfMake.vfs`. Support both so fonts always resolve.
      const vfsModule = await import('pdfmake/build/vfs_fonts') as unknown as {
        default?: { pdfMake?: { vfs?: Record<string, string> }; vfs?: Record<string, string> } | Record<string, string>;
        pdfMake?: { vfs?: Record<string, string> };
        vfs?: Record<string, string>;
      };
      const d = vfsModule.default as { pdfMake?: { vfs?: Record<string, string> }; vfs?: Record<string, string> } & Record<string, string> | undefined;
      const vfs =
        d?.pdfMake?.vfs ??
        d?.vfs ??
        (d && typeof d === 'object' && !('pdfMake' in d) && !('vfs' in d) ? (d as Record<string, string>) : undefined) ??
        vfsModule.pdfMake?.vfs ??
        vfsModule.vfs;
      pdfMake.vfs = vfs as Record<string, string>;

      const netProfit = Number(summary.netProfit ?? 0);
      const profitColor = netProfit >= 0 ? '#166534' : '#991b1b';

      const content: unknown[] = [
        { text: event?.eventName ?? 'Post-Event Report', style: 'title' },
        { text: formatDateRange(event?.eventDate, event?.numDays), style: 'subtitle', margin: [0, 0, 0, 16] },

        // Event summary chips
        ...(event?.status ? [{ text: `Status: ${event.status}`, style: 'chip' }] : []),
        ...(event?.eventHost ? [{ text: `Host: ${event.eventHost}`, style: 'chip' }] : []),
        ...(event?.eventLocation ? [{ text: `Location: ${event.eventLocation}`, style: 'chip' }] : []),

        { text: 'Sales Summary', style: 'sectionHeader', margin: [0, 16, 0, 4] },
        buildTable([
          ['', ''],
          ['Gross Sales', fmt(sales.grossSales)],
          ['Returns', `-${fmt(sales.refunds)}`],
          ['Discounts', `-${fmt(sales.discounts)}`],
          ['Net Sales', fmt(sales.netSales)],
        ]),

        { text: 'Cost of Goods Sold', style: 'sectionHeader', margin: [0, 12, 0, 4] },
        buildTable([
          ['', ''],
          ['Ingredient Costs (COGS)', `-${fmt(summary.cogs)}`],
          ['Gross Profit', fmt(summary.grossProfit)],
        ]),
      ];

      // Labor table
      if (laborEntries.length > 0) {
        content.push({ text: 'Labor', style: 'sectionHeader', margin: [0, 12, 0, 4] });
        content.push({
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              [{ text: 'Name', bold: true }, { text: 'Hours', bold: true }, { text: 'Wage', bold: true }, { text: 'Total', bold: true }],
              ...laborEntries.map((r: Record<string, unknown>) => [
                String(r['name'] ?? ''),
                String(Number(r['hours']).toFixed(2)),
                `$${Number(r['wage']).toFixed(2)}/hr`,
                fmt(r['total'] as number),
              ]),
              [{ text: 'Total Labor', bold: true, colSpan: 3 }, {}, {}, { text: fmt(summary.laborFees), bold: true }],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 8],
        });
      }

      // Supplies table
      if (supplies.length > 0) {
        content.push({ text: 'Supplies', style: 'sectionHeader', margin: [0, 12, 0, 4] });
        content.push({
          table: {
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              [{ text: 'Item', bold: true }, { text: 'Qty', bold: true }, { text: 'Unit Cost', bold: true }, { text: 'Total', bold: true }],
              ...supplies.map((r: Record<string, unknown>) => [
                String(r['name'] ?? ''),
                String(Number(r['quantity']).toFixed(2)),
                fmt(r['unitCost'] as number),
                fmt(r['total'] as number),
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 8],
        });
      }

      // Expenses
      content.push({ text: 'Operating Expenses', style: 'sectionHeader', margin: [0, 12, 0, 4] });
      content.push(buildTable([
        ['', ''],
        ['Health Dept Fee', `-${fmt(expenses.healthDeptFee)}`],
        ['Event Fee', `-${fmt(expenses.eventFee)}`],
        ['Mileage Reimbursement', `-${fmt(summary.mileageReimbursement)}`],
        ['Employee Bonus', `-${fmt(expenses.employeeBonus)}`],
        ['Event Runner Fees', `-${fmt(expenses.eventRunnerFees)}`],
        ['Labor Fees', `-${fmt(summary.laborFees)}`],
        ['Coordinator Fee', `-${fmt(expenses.coordinatorFee)}`],
        ['POS Fees', `-${fmt(summary.posFees)}`],
        ['Additional Fees', `-${fmt(summary.additionalFeesTotal)}`],
        ['Total Operating Expenses', `-${fmt(summary.totalExpenses)}`],
      ]));

      // Net Profit
      content.push({
        table: {
          widths: ['*', 'auto'],
          body: [[
            { text: 'NET PROFIT', bold: true, fontSize: 14 },
            { text: fmt(netProfit), bold: true, fontSize: 14, color: profitColor },
          ]],
        },
        layout: 'noBorders',
        margin: [0, 16, 0, 8],
      });

      // For your records
      content.push({ text: 'For Your Records (Informational)', style: 'sectionHeader', margin: [0, 12, 0, 4] });
      content.push(buildTable([
        ['', ''],
        ['Tips (pass-through to staff)', fmt(summary.tips)],
        [`Sales tax — ${taxes.jurisdiction?.state ?? 'State'} (${(Number(taxes.stateRate ?? 0) * 100).toFixed(2)}%)`, fmt(Number(taxes.stateTax ?? 0))],
        [`Sales tax — ${taxes.jurisdiction?.city ?? taxes.jurisdiction?.county ?? 'Local'} (${(Number(taxes.localRate ?? 0) * 100).toFixed(2)}%)`, fmt(Number(taxes.localTax ?? 0))],
        ['Total sales tax collected (to remit)', fmt(Number(taxes.taxCollected ?? 0))],
      ]));

      const docDef = {
        content,
        styles: {
          title: { fontSize: 20, bold: true, color: '#0B2A4A' },
          subtitle: { fontSize: 11, color: '#64748b' },
          chip: { fontSize: 10, color: '#5B6B7C', margin: [0, 2, 4, 0] },
          sectionHeader: { fontSize: 9, bold: true, color: '#64748b', decoration: 'underline' as const },
        },
        defaultStyle: { fontSize: 10, font: 'Roboto' },
      };

      pdfMake.createPdf(docDef).download(`PostEventReport_${(event?.eventName ?? 'Event').replace(/[^a-z0-9]/gi, '_')}.pdf`);
      showToast('PDF downloaded!', 'success');
    } catch (err) {
      showToast('PDF export failed: ' + (err instanceof Error ? err.message : 'unknown error'), 'error');
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner spinner-dark" style={{ width: 28, height: 28, borderWidth: 3 }} /></div>;
  }

  if (error || !report) {
    return <div className="inline-error"><span>⚠️</span><span>Could not load report. {error?.message}</span></div>;
  }

  const netProfit = Number(summary.netProfit ?? 0);
  const stateRate = Number(taxes.stateRate ?? 0);
  const localRate = Number(taxes.localRate ?? 0);
  const stateTax = Number(taxes.stateTax ?? 0);
  const localTax = Number(taxes.localTax ?? 0);
  const taxCollected = Number(taxes.taxCollected ?? 0);
  const jur = taxes.jurisdiction ?? null;

  return (
    <>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn-primary" onClick={downloadPDF}>📄 Download PDF</button>
        <button className="btn-secondary" onClick={() => window.print()}>🖨 Print</button>
        <Link to={`/companies/${companyId}/events/${eventId}`} className="btn-secondary" style={{ textDecoration: 'none' }}>⬅ Back to Dashboard</Link>
      </div>

      {/* Report card */}
      <div className="card" id="report-content" style={{ maxWidth: 760 }}>
        {/* Header */}
        <div style={{ borderBottom: '2px solid var(--vv-navy)', paddingBottom: 16, marginBottom: 20 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', color: 'var(--vv-navy)', fontFamily: 'DM Serif Display, serif' }}>
            <i className="fa-solid fa-chart-bar" /> Post-Event Report
          </h1>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--vv-navy)', marginBottom: 2 }}>
            {event?.eventName}
          </div>
          <div style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
            {formatDateRange(event?.eventDate, event?.numDays)}
            {event?.isFinalized && <span className="finalized-badge-large" style={{ marginLeft: 10 }}>FINALIZED</span>}
          </div>
          {/* Meta */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, fontSize: '0.85rem', color: 'var(--muted)' }}>
            {event?.status && <span><strong>Status:</strong> {event.status}</span>}
            {event?.eventHost && <span><strong>Host:</strong> {event.eventHost}</span>}
            {event?.eventLocation && <span><strong>Location:</strong> {event.eventLocation}</span>}
            {event?.coordinator && <span><strong>Coordinator:</strong> {event.coordinator}</span>}
          </div>
        </div>

        {/* Sales Summary */}
        <SectionHeader title="Sales Summary" />
        <Row label="Gross Sales" value={fmt(sales.grossSales)} />
        <Row label="Returns" value={`-${fmt(sales.refunds)}`} />
        <Row label="Discounts" value={`-${fmt(sales.discounts)}`} />
        <Row label="Net Sales" value={fmt(sales.netSales)} bold />

        {/* COGS */}
        <SectionHeader title="Cost of Goods Sold (COGS)" />
        <Row label="Ingredient Costs" value={`-${fmt(summary.cogs)}`} />
        <Row label="Gross Profit" value={fmt(summary.grossProfit)} bold
          color={Number(summary.grossProfit ?? 0) >= 0 ? '#166534' : '#991b1b'} />

        {/* Labor */}
        {laborEntries.length > 0 && (
          <>
            <SectionHeader title="Labor" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', marginBottom: 8 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>Hours</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>Wage</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {laborEntries.map((r: Record<string, unknown>, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>{r['name'] as string}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{Number(r['hours']).toFixed(2)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>${Number(r['wage']).toFixed(2)}/hr</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{fmt(r['total'] as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Row label="Total Labor" value={`-${fmt(summary.laborFees)}`} bold />
          </>
        )}

        {/* Supplies */}
        {supplies.length > 0 && (
          <>
            <SectionHeader title="Supplies" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', marginBottom: 8 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600 }}>Item</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>Qty</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>Unit Cost</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {supplies.map((r: Record<string, unknown>, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>{r['name'] as string}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{Number(r['quantity']).toFixed(2)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{fmt(r['unitCost'] as number)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{fmt(r['total'] as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Inventory Sales */}
        {inventorySales.length > 0 && (
          <>
            <SectionHeader title="Items Sold (Inventory)" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', marginBottom: 8 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600 }}>Item</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>Qty Sold</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>Unit Cost</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>Total COGS</th>
                </tr>
              </thead>
              <tbody>
                {inventorySales.map((r: Record<string, unknown>, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>{r['name'] as string}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{Number(r['quantitySold'])}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{r['unitPrice'] != null ? fmt(r['unitPrice'] as number) : '—'}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>{fmt(r['totalCost'] as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Operating Expenses */}
        <SectionHeader title="Operating Expenses" />
        {Number(expenses.healthDeptFee ?? 0) > 0 && <Row label="Health Dept Fee" value={`-${fmt(expenses.healthDeptFee)}`} />}
        {Number(expenses.eventFee ?? 0) > 0 && <Row label="Event Fee" value={`-${fmt(expenses.eventFee)}`} />}
        {Number(summary.mileageReimbursement ?? 0) > 0 && <Row label="Mileage Reimbursement" value={`-${fmt(summary.mileageReimbursement)}`} />}
        {Number(expenses.employeeBonus ?? 0) > 0 && <Row label="Employee Bonus" value={`-${fmt(expenses.employeeBonus)}`} />}
        {Number(expenses.eventRunnerFees ?? 0) > 0 && <Row label="Event Runner Fees" value={`-${fmt(expenses.eventRunnerFees)}`} />}
        {Number(summary.laborFees ?? 0) > 0 && <Row label="Labor Fees" value={`-${fmt(summary.laborFees)}`} />}
        {Number(expenses.coordinatorFee ?? 0) > 0 && <Row label="Coordinator Fee" value={`-${fmt(expenses.coordinatorFee)}`} />}
        {Number(summary.posFees ?? 0) > 0 && <Row label="POS Fees" value={`-${fmt(summary.posFees)}`} />}
        {Number(summary.additionalFeesTotal ?? 0) !== 0 && <Row label="Additional Fees / Discounts" value={`-${fmt(summary.additionalFeesTotal)}`} />}
        <Row label="Total Operating Expenses" value={`-${fmt(summary.totalExpenses)}`} bold />

        {/* Net Profit */}
        <div style={{ background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', border: `2px solid ${netProfit >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: 10, padding: '16px 18px', margin: '18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--vv-navy)' }}>NET PROFIT</span>
          <span style={{ fontWeight: 800, fontSize: '1.3rem', color: netProfit >= 0 ? '#166534' : '#991b1b', fontVariantNumeric: 'tabular-nums' }}>{fmt(netProfit)}</span>
        </div>

        {/* For your records */}
        <SectionHeader title="For Your Records (Informational)" />
        <Row label="Tips (pass-through to staff)" value={fmt(summary.tips)} />
        <Row label={`Sales tax — remit to ${jur?.state ?? 'State'} (${(stateRate * 100).toFixed(2)}%)`} value={fmt(stateTax)} />
        <Row label={`Sales tax — remit to ${jur?.city ?? jur?.county ?? 'Local'} (${(localRate * 100).toFixed(2)}%)`} value={fmt(localTax)} />
        <Row label="Total sales tax collected (to remit)" value={fmt(taxCollected)} />
        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 8 }}>
          ⓘ Income taxes are calculated annually — consult your accountant.
        </p>
      </div>
    </>
  );
}

// ── PDF helper ────────────────────────────────────────────────────────────────

function buildTable(rows: string[][]): unknown {
  return {
    table: {
      widths: ['*', 'auto'],
      body: rows.map(([label, value]) => [
        { text: label, color: '#374151' },
        { text: value, alignment: 'right', color: '#374151' },
      ]),
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 4],
  };
}
