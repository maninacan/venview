import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { showToast } from '../../hooks/useToast';

const GET_EVENTS = gql`
  query GetEvents($companyId: ID!, $filter: String, $search: String) {
    events(companyId: $companyId, filter: $filter, search: $search) {
      id eventName eventDate status isFinalized squareLocationId
      netProfit
      sales { grossSales netSales }
    }
  }
`;

const GET_KPI = gql`
  query GetEventKpi($companyId: ID!) {
    eventKpi(companyId: $companyId) { totalEvents finalizedCount grossSales netSales }
  }
`;

const GET_TREND = gql`
  query GetEventTrend($companyId: ID!) {
    eventTrend(companyId: $companyId) { eventId name date netProfit }
  }
`;

type FilterType = 'all' | 'finalized' | 'notfinalized';

function fmt(v: number | null | undefined) {
  return `$${Number(v ?? 0).toFixed(2)}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function EventsPage() {
  const { companyId } = useCurrentCompany();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const filterVar = filter === 'all' ? undefined : filter;

  const { data: eventsData, loading: eventsLoading } = useQuery(GET_EVENTS, {
    variables: { companyId, filter: filterVar, search: search || undefined },
    skip: !companyId,
  });
  const { data: kpiData } = useQuery(GET_KPI, { variables: { companyId }, skip: !companyId });
  const { data: trendData } = useQuery(GET_TREND, { variables: { companyId }, skip: !companyId });

  const events = eventsData?.events ?? [];
  const kpi = kpiData?.eventKpi;
  const trend = (trendData?.eventTrend ?? []).map((t: { date: string; netProfit: number; name: string; eventId: string }) => ({
    ...t,
    date: formatDate(t.date),
    profit: Number(t.netProfit.toFixed(2)),
  }));

  function handleSearch() {
    setSearch(searchInput);
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
  }

  function exportCSV() {
    const rows = [
      ['Event Name', 'Date', 'Status', 'Gross Sales', 'Net Profit', 'Finalized'],
      ...events.map((e: Record<string, unknown>) => [
        e['eventName'],
        formatDate(e['eventDate'] as string),
        e['status'] ?? '',
        fmt((e as { sales?: { grossSales?: number } })['sales']?.grossSales),
        fmt(e['netProfit'] as number),
        e['isFinalized'] ? 'Yes' : 'No',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'events.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported', 'success');
  }

  if (!companyId) return null;

  return (
    <>
      <div className="card">
        <h2 style={{ margin: '0 0 16px', color: 'var(--vv-navy)' }}>Manage Events</h2>

        {/* KPI chips */}
        {kpi && (
          <div className="kpi-row">
            <div className="kpi-chip">
              <span className="kpi-chip-label">Total Events</span>
              <span className="kpi-chip-value">{kpi.totalEvents}</span>
            </div>
            <div className="kpi-chip">
              <span className="kpi-chip-label">Finalized</span>
              <span className="kpi-chip-value">{kpi.finalizedCount}</span>
            </div>
            <div className="kpi-chip">
              <span className="kpi-chip-label">Gross Sales</span>
              <span className="kpi-chip-value">{fmt(kpi.grossSales)}</span>
            </div>
            <div className="kpi-chip">
              <span className="kpi-chip-label">Net Sales</span>
              <span className="kpi-chip-value">{fmt(kpi.netSales)}</span>
            </div>
          </div>
        )}

        {/* Profit chart */}
        {trend.length > 1 && (
          <div style={{ background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>Net Profit per Event</span>
              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>All events · sorted by date</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#19B37A" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#19B37A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${Number(v).toFixed(2)}`, 'Net Profit']} />
                <Area type="monotone" dataKey="profit" stroke="#19B37A" strokeWidth={2} fill="url(#profitGrad)" dot={{ r: 3, fill: '#19B37A' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Filter + search bar */}
        <div className="manage-filter-bar">
          {(['all', 'finalized', 'notfinalized'] as FilterType[]).map(f => (
            <button
              key={f}
              className={filter === f ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setFilter(f)}
              style={{ fontSize: '0.83rem', padding: '6px 13px' }}
            >
              {f === 'all' ? 'All' : f === 'finalized' ? 'Finalized' : 'Not Finalized'}
            </button>
          ))}
        </div>

        <div className="search-fields">
          <input
            type="text"
            placeholder="Event name"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ maxWidth: 220 }}
          />
          <button className="btn-secondary" onClick={handleSearch}>🔍 Search</button>
          <button className="btn-secondary" onClick={clearSearch}>🧹 Clear</button>
          <button className="btn-secondary" onClick={exportCSV}>📥 Export CSV</button>
          <Link to={`/companies/${companyId}/events/new`} className="btn-primary" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
            + Add Event
          </Link>
        </div>

        {/* Events table */}
        <div className="table-container">
          {eventsLoading ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', padding: '16px 0' }}>Loading events…</p>
          ) : events.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', padding: '16px 0', textAlign: 'center' }}>
              No events found. <Link to={`/companies/${companyId}/events/new`} style={{ color: 'var(--vv-navy)', fontWeight: 600 }}>Add your first event →</Link>
            </p>
          ) : (
            <table className="events-table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Gross Sales</th>
                  <th>Net Profit</th>
                  <th>Finalized</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e: Record<string, unknown>) => (
                  <tr key={e['id'] as string} onClick={() => navigate(`/companies/${companyId}/events/${e['id']}`)}>
                    <td style={{ fontWeight: 600 }}>{e['eventName'] as string}</td>
                    <td>{formatDate(e['eventDate'] as string)}</td>
                    <td>
                      <span style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: 99 }}>
                        {(e['status'] as string) || '—'}
                      </span>
                    </td>
                    <td>{fmt((e as { sales?: { grossSales?: number } })['sales']?.grossSales)}</td>
                    <td style={{ color: Number(e['netProfit']) >= 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>
                      {fmt(e['netProfit'] as number)}
                    </td>
                    <td>
                      {e['isFinalized']
                        ? <span className="finalized-badge-large">FINALIZED</span>
                        : <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
