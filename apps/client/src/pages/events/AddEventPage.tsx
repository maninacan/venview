import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { showToast } from '@org/data';

const API_URL = (import.meta.env['VITE_API_URL'] as string) || 'http://localhost:3000';

const EVENT_RATING_OPTIONS = ['A', 'B', 'C', 'D', 'F'];

// ── GraphQL ──────────────────────────────────────────────────────────────────
const GET_EVENT = gql`
  query GetEventForEdit($id: ID!) {
    event(id: $id) {
      id eventName eventType eventRating eventDate applicationDate
      eventLocation zipCode permits eventHost coordinator employees notes
      squareLocationId numDays
      days { id dayNumber date startTime endTime }
    }
  }
`;
const GET_SQUARE_LOCATIONS = gql`
  query GetSquareLocations($companyId: ID!) {
    squareLocations(companyId: $companyId) { id name }
  }
`;
const CREATE_EVENT = gql`
  mutation CreateEvent($companyId: ID!, $input: CreateEventInput!) {
    createEvent(companyId: $companyId, input: $input) { id }
  }
`;
const UPDATE_EVENT = gql`
  mutation UpdateEvent($id: ID!, $input: UpdateEventInput!) {
    updateEvent(id: $id, input: $input) { id }
  }
`;

// ── Date / time helpers ──────────────────────────────────────────────────────
function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function fmtMonthDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtRange(startISO: string, numDays: number): string {
  if (!startISO) return '';
  const endISO = addDaysISO(startISO, Math.max(0, numDays - 1));
  const year = endISO.split('-')[0];
  if (numDays <= 1) return `Runs ${fmtMonthDay(startISO)}, ${year} · 1 day`;
  return `Runs ${fmtMonthDay(startISO)}–${fmtMonthDay(endISO)}, ${year} · ${numDays} days`;
}

const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const ampm = h < 12 ? 'AM' : 'PM';
      const hh = ((h + 11) % 12) + 1;
      out.push(`${hh}:${String(m).padStart(2, '0')} ${ampm}`);
    }
  }
  return out;
})();

interface DayRow { dayNumber: number; eventDate: string; startTime: string; endTime: string; }

const EMPTY_FORM = {
  eventName: '', eventType: '', eventRating: '',
  eventDate: '', applicationDate: '',
  eventLocation: '', zipCode: '', permits: '',
  eventHost: '', coordinator: '', employees: '', notes: '',
  squareLocationId: '',
};
type EventFormState = typeof EMPTY_FORM;

export function AddEventPage() {
  const navigate = useNavigate();
  const { companyId } = useCurrentCompany();
  const { eventId } = useParams<{ eventId: string }>();
  const isEdit = !!eventId;

  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);
  const [numDays, setNumDays] = useState(1);
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: setupData } = useQuery(GET_SQUARE_LOCATIONS, { variables: { companyId }, skip: !companyId });
  const { data: editData } = useQuery(GET_EVENT, { variables: { id: eventId }, skip: !isEdit });

  const [createEvent] = useMutation(CREATE_EVENT);
  const [updateEvent] = useMutation(UPDATE_EVENT);

  const squareLocations: Array<{ id: string; name: string }> = setupData?.squareLocations ?? [];

  function setField<K extends keyof EventFormState>(key: K, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  // Prefill when editing
  useEffect(() => {
    if (!editData?.event) return;
    const ev = editData.event;
    setForm({
      eventName: ev.eventName ?? '', eventType: ev.eventType ?? '', eventRating: ev.eventRating ?? '',
      eventDate: ev.eventDate ?? '', applicationDate: ev.applicationDate ?? '',
      eventLocation: ev.eventLocation ?? '', zipCode: ev.zipCode ?? '', permits: ev.permits ?? '',
      eventHost: ev.eventHost ?? '', coordinator: ev.coordinator ?? '', employees: ev.employees ?? '',
      notes: ev.notes ?? '', squareLocationId: ev.squareLocationId ?? '',
    });
    setNumDays(ev.numDays ?? 1);
    setDays((ev.days ?? []).map((d: { dayNumber: number; date: string; startTime: string; endTime: string }) => ({
      dayNumber: d.dayNumber, eventDate: d.date ?? '', startTime: d.startTime ?? '', endTime: d.endTime ?? '',
    })));
  }, [editData]);

  // Keep the day rows in sync with numDays + start date
  useEffect(() => {
    setDays(prev => Array.from({ length: numDays }, (_, i) => ({
      dayNumber: i + 1,
      eventDate: prev[i]?.eventDate || (form.eventDate ? addDaysISO(form.eventDate, i) : ''),
      startTime: prev[i]?.startTime ?? '',
      endTime: prev[i]?.endTime ?? '',
    })));
  }, [numDays, form.eventDate]);

  // Assemble the mutation input from current form state.
  function buildInput() {
    const input: Record<string, unknown> = {
      eventName: form.eventName.trim(),
      eventType: form.eventType || null,
      eventRating: form.eventRating || null,
      eventDate: form.eventDate || null,
      applicationDate: form.applicationDate || null,
      eventLocation: form.eventLocation || null,
      zipCode: form.zipCode || null,
      permits: form.permits || null,
      eventHost: form.eventHost || null,
      coordinator: form.coordinator || null,
      employees: form.employees || null,
      notes: form.notes || null,
      squareLocationId: form.squareLocationId || null,
      numDays,
    };
    if (numDays > 1) {
      input['endDate'] = addDaysISO(form.eventDate, numDays - 1);
      input['days'] = days.map(d => ({
        dayNumber: d.dayNumber,
        eventDate: d.eventDate || null,
        startTime: d.startTime || null,
        endTime: d.endTime || null,
      }));
    }
    return input;
  }

  function validate(): boolean {
    if (!form.eventName.trim()) { showToast('Event name is required', 'error'); return false; }
    if (!form.eventDate) { showToast('Start date is required', 'error'); return false; }
    if (!form.eventLocation.trim()) { showToast('Venue name is required', 'error'); return false; }
    if (!form.zipCode.trim()) { showToast('ZIP code is required', 'error'); return false; }
    return true;
  }

  async function uploadPermits(targetEventId: string) {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) return;
    const { supabase } = await import('@org/data');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const fd = new FormData();
    fd.append('eventId', targetEventId);
    Array.from(files).forEach(f => fd.append('files', f));
    await fetch(`${API_URL}/api/uploads/permit`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
  }

  // ── Create flow (essentials) ──────────────────────────────────────────────
  async function handleCreate(addDetails: boolean) {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await createEvent({ variables: { companyId, input: buildInput() } });
      const newId = data.createEvent.id;
      showToast('Event created!', 'success');
      navigate(addDetails
        ? `/companies/${companyId}/events/${newId}/edit`
        : `/companies/${companyId}/events/${newId}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create event', 'error');
    } finally { setLoading(false); }
  }

  // ── Edit flow ──────────────────────────────────────────────────────────────
  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!validate() || !eventId) return;
    setLoading(true);
    try {
      await updateEvent({ variables: { id: eventId, input: buildInput() } });
      await uploadPermits(eventId);
      showToast('Event updated!', 'success');
      navigate(`/companies/${companyId}/events/${eventId}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save event', 'error');
    } finally { setLoading(false); }
  }

  async function handleDuplicate() {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await createEvent({ variables: { companyId, input: buildInput() } });
      const newId = data.createEvent.id;
      showToast('Duplicated as a new event!', 'success');
      navigate(`/companies/${companyId}/events/${newId}/edit`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to duplicate event', 'error');
    } finally { setLoading(false); }
  }

  // ════════════════════════ CREATE — Step 1 essentials ════════════════════════
  if (!isEdit) {
    return (
      <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 16px', color: 'var(--vv-navy)' }}>Add an event</h2>
        <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: '0.92rem' }}>
          Just the essentials. You can fill in everything else later.
        </p>

        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 6 }}>
          STEP 1 OF 2 · ESSENTIALS
        </div>
        <div style={{ height: 8, borderRadius: 99, background: '#e2e8f0', marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ width: '50%', height: '100%', background: '#16a34a', borderRadius: 99 }} />
        </div>

        <form onSubmit={e => { e.preventDefault(); handleCreate(false); }}>
          <div className="form-group">
            <label>Event name <span style={{ color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>REQUIRED</span></label>
            <input type="text" value={form.eventName} onChange={e => setField('eventName', e.target.value)} placeholder="e.g., Rocky Mountain Baseball" autoFocus />
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 220, margin: 0 }}>
              <label>Start date <span style={{ color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>REQUIRED</span></label>
              <input type="date" value={form.eventDate} onChange={e => setField('eventDate', e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>How many days? <span style={{ color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>REQUIRED</span></label>
              <DayStepper value={numDays} onChange={setNumDays} />
            </div>
          </div>

          {form.eventDate && (
            <div style={{ background: '#dcfce7', color: '#15803d', borderRadius: 8, padding: '8px 14px', fontSize: '0.86rem', fontWeight: 600, margin: '12px 0 4px' }}>
              {fmtRange(form.eventDate, numDays)}
            </div>
          )}

          <div className="form-group" style={{ marginTop: 16 }}>
            <label>Venue name <span style={{ color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>REQUIRED</span></label>
            <input type="text" value={form.eventLocation} onChange={e => setField('eventLocation', e.target.value)} placeholder="e.g., Patriot Park" />
          </div>

          <div className="form-group">
            <label>ZIP code <span style={{ color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>REQUIRED</span></label>
            <input type="text" value={form.zipCode} onChange={e => setField('zipCode', e.target.value)} placeholder="84043" />
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '4px 0 0' }}>We use this to auto-look-up your sales tax rate.</p>
          </div>

          <div style={{ background: '#eff6ff', borderLeft: '3px solid #0B2A4A', borderRadius: 6, padding: '12px 14px', fontSize: '0.86rem', color: 'var(--vv-navy)', margin: '16px 0' }}>
            <strong>Almost done.</strong> After this you can add host, coordinator, permits and notes — or skip and add them anytime from the event page.
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button type="button" className="btn-secondary" style={{ background: 'none', border: 'none', color: 'var(--muted)' }} onClick={() => navigate(`/companies/${companyId}/events`)}>
              Cancel
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => handleCreate(true)} disabled={loading}
                className="text-white border-0 font-semibold rounded-full px-5 py-2.5 cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
                style={{ background: '#00ABE2' }}>
                {loading && <span className="spinner" />} <span>Create &amp; add details</span>
              </button>
              <button type="submit" disabled={loading}
                className="text-white border-0 font-semibold rounded-full px-5 py-2.5 cursor-pointer inline-flex items-center gap-2 disabled:opacity-60"
                style={{ background: '#16a34a' }}>
                {loading && <span className="spinner" />} <span>Create event</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ════════════════════════ EDIT — full details ════════════════════════
  const sectionHeading: React.CSSProperties = { color: '#16a34a', fontWeight: 700, fontSize: '1.05rem', margin: '22px 0 12px' };

  return (
    <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 16px', color: 'var(--vv-navy)' }}>Add an event</h2>

      <form onSubmit={handleUpdate}>
        {/* Permit documents */}
        <div className="form-group">
          <label>Permit Documents</label>
          <input type="file" ref={fileInputRef} multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.doc,.docx" />
        </div>

        {/* Square location */}
        <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Square Location</label>
        {squareLocations.length === 0 ? (
          <div style={{ background: '#eff6ff', border: '1px dashed #93c5fd', borderRadius: 8, padding: '12px 14px', margin: '6px 0 4px', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--vv-navy)' }}>📍 No Square locations found</div>
            <div style={{ color: '#3b6fb0' }}>Connect your Square account to link a location and enable automatic sales sync.</div>
            <a href={`/companies/${companyId}/settings`} style={{ color: '#0085b0', fontWeight: 600 }}>Connect Square in Settings →</a>
          </div>
        ) : (
          <select value={form.squareLocationId} onChange={e => setField('squareLocationId', e.target.value)} style={{ marginTop: 6 }}>
            <option value="">Select Square Location…</option>
            {squareLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
        )}

        {/* The basics */}
        <div style={sectionHeading}>The basics</div>
        <div className="form-group">
          <label>Event Name *</label>
          <input type="text" value={form.eventName} onChange={e => setField('eventName', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Event Type</label>
          <input type="text" value={form.eventType} onChange={e => setField('eventType', e.target.value)} placeholder="e.g., Baseball tournament" />
        </div>
        <div className="form-group">
          <label>Event Rating</label>
          <select value={form.eventRating} onChange={e => setField('eventRating', e.target.value)}>
            <option value=""></option>
            {EVENT_RATING_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* When */}
        <div style={sectionHeading}>When</div>
        <div className="form-group">
          <label>Event Date *</label>
          <input type="date" value={form.eventDate} onChange={e => setField('eventDate', e.target.value)} />
        </div>
        <div className="form-group">
          <label>How many days?</label>
          <DayStepper value={numDays} onChange={setNumDays} fullWidth />
        </div>
        {days.map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', width: 48 }}>Day {i + 1}</span>
            <input type="date" value={d.eventDate} style={{ width: 170 }}
              onChange={e => setDays(prev => prev.map((x, j) => j === i ? { ...x, eventDate: e.target.value } : x))} />
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Start</span>
            <TimeSelect value={d.startTime} onChange={v => setDays(prev => prev.map((x, j) => j === i ? { ...x, startTime: v } : x))} />
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>End</span>
            <TimeSelect value={d.endTime} onChange={v => setDays(prev => prev.map((x, j) => j === i ? { ...x, endTime: v } : x))} />
          </div>
        ))}
        <div className="form-group">
          <label>Application Date</label>
          <input type="date" value={form.applicationDate} onChange={e => setField('applicationDate', e.target.value)} />
        </div>

        {/* Where & permits */}
        <div style={sectionHeading}>Where &amp; permits</div>
        <div className="form-group">
          <label>Event Location *</label>
          <input type="text" value={form.eventLocation} onChange={e => setField('eventLocation', e.target.value)} placeholder="Venue name and address" />
        </div>
        <div className="form-group">
          <label>Zip Code *</label>
          <input type="text" value={form.zipCode} onChange={e => setField('zipCode', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Permits</label>
          <textarea value={form.permits} onChange={e => setField('permits', e.target.value)} rows={2} placeholder="e.g., Health permit submitted 04/01, awaiting approval" />
        </div>

        {/* Who's running it */}
        <div style={sectionHeading}>Who's running it</div>
        <div className="form-group">
          <label>Event Host</label>
          <input type="text" value={form.eventHost} onChange={e => setField('eventHost', e.target.value)} placeholder="Host name and contact" />
        </div>
        <div className="form-group">
          <label>Coordinator</label>
          <input type="text" value={form.coordinator} onChange={e => setField('coordinator', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Employees</label>
          <input type="text" value={form.employees} onChange={e => setField('employees', e.target.value)} placeholder="Expected staff on site" />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} placeholder="Internal notes for your team" />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading && <span className="spinner" />} <span>💾 Update Event</span>
          </button>
          <button type="button" className="btn-secondary" onClick={handleDuplicate} disabled={loading}>
            📋 Duplicate as New Event
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(`/companies/${companyId}/events/${eventId}`)}>
            ↩ Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Small controls ───────────────────────────────────────────────────────────
function DayStepper({ value, onChange, fullWidth }: { value: number; onChange: (n: number) => void; fullWidth?: boolean }) {
  const btn: React.CSSProperties = { width: 40, height: 38, borderRadius: 8, border: '1px solid var(--border)', background: '#f1f5f9', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: fullWidth ? '1px solid var(--border)' : 'none', borderRadius: 8, padding: fullWidth ? 6 : 0, width: fullWidth ? '100%' : 'auto' }}>
      <button type="button" style={btn} onClick={() => onChange(Math.max(1, value - 1))} aria-label="Fewer days">−</button>
      <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{value}</span>
      <button type="button" style={btn} onClick={() => onChange(Math.min(30, value + 1))} aria-label="More days">+</button>
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: 120 }}>
      <option value="">-- Time --</option>
      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}
