import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { showToast } from '@org/data';

// ── Canonical field → DB key mapping (ported from old app) ───────────────────
const CANONICAL_LABEL_TO_DBKEY: Record<string, string> = {
  'Event Name': 'eventName',
  'Event Date': 'eventDate',
  'Application Date': 'applicationDate',
  'Event Host': 'eventHost',
  'Event Rating': 'eventRating',
  'Event Type': 'eventType',
  'Status': 'status',
  'Coordinator': 'coordinator',
  'Notes': 'notes',
  'Event Fee': 'eventFee',
  'Event Location': 'eventLocation',
  'Time': 'time',
  'Square Location': 'squareLocationId',
  'Zip Code': 'zipCode',
  'ZIP Code': 'zipCode',
};

interface FormField {
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

// ── Default fields used when no template is active ───────────────────────────
const DEFAULT_FIELDS: FormField[] = [
  { label: 'Event Name', type: 'text', required: true },
  { label: 'Event Date', type: 'date', required: true },
  { label: 'ZIP Code', type: 'text' },
  { label: 'Status', type: 'select', options: ['Pending', 'Confirmed', 'Completed', 'Cancelled'] },
  { label: 'Event Type', type: 'text' },
  { label: 'Event Host', type: 'text' },
  { label: 'Event Location', type: 'text' },
  { label: 'Coordinator', type: 'text' },
  { label: 'Time', type: 'text' },
  { label: 'Application Date', type: 'date' },
  { label: 'Event Rating', type: 'text' },
  { label: 'Notes', type: 'textarea' },
];

// ── GraphQL ──────────────────────────────────────────────────────────────────
const GET_EVENT = gql`
  query GetEventForEdit($id: ID!) {
    event(id: $id) {
      id eventName eventDate status eventType eventHost eventLocation
      coordinator notes zipCode squareLocationId time applicationDate
      eventRating customFields numDays
      days { id dayNumber date startTime endTime }
    }
  }
`;

const GET_FORM_SETUP = gql`
  query GetFormSetup($companyId: ID!) {
    formTemplates(companyId: $companyId) { id templateName fields isActive }
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function safeLabelToKey(label: string) {
  return CANONICAL_LABEL_TO_DBKEY[label] ?? label.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

export function AddEventPage() {
  const navigate = useNavigate();
  const { companyId } = useCurrentCompany();
  const { eventId } = useParams<{ eventId: string }>();
  const isEdit = !!eventId;

  const [values, setValues] = useState<Record<string, string>>({});
  const [numDays, setNumDays] = useState(1);
  const [days, setDays] = useState<Array<{ dayNumber: number; eventDate: string; startTime: string; endTime: string }>>([]);
  const [activeFields, setActiveFields] = useState<FormField[]>(DEFAULT_FIELDS);
  const [loading, setLoading] = useState(false);

  const { data: setupData } = useQuery(GET_FORM_SETUP, {
    variables: { companyId },
    skip: !companyId,
  });

  const { data: editData } = useQuery(GET_EVENT, {
    variables: { id: eventId },
    skip: !isEdit,
  });

  const [createEvent] = useMutation(CREATE_EVENT);
  const [updateEvent] = useMutation(UPDATE_EVENT);

  // Activate template fields if one is marked active
  useEffect(() => {
    const templates = setupData?.formTemplates ?? [];
    const active = templates.find((t: { isActive: boolean }) => t.isActive);
    if (active?.fields) {
      const fields = Array.isArray(active.fields[0]?.fields) ? active.fields[0].fields : active.fields;
      if (Array.isArray(fields) && fields.length > 0) setActiveFields(fields as FormField[]);
    }
  }, [setupData]);

  // Prefill form when editing
  useEffect(() => {
    if (!editData?.event) return;
    const ev = editData.event;
    const prefill: Record<string, string> = {};
    for (const field of activeFields) {
      const key = safeLabelToKey(field.label);
      const val = ev[key] ?? ev.customFields?.[field.label] ?? '';
      prefill[field.label] = val ? String(val) : '';
    }
    setValues(prefill);
    setNumDays(ev.numDays ?? 1);
    setDays(ev.days ?? []);
  }, [editData, activeFields]);

  // Rebuild days array when numDays changes
  useEffect(() => {
    setDays(prev => {
      const next = Array.from({ length: numDays }, (_, i) => ({
        dayNumber: i + 1,
        eventDate: prev[i]?.eventDate ?? '',
        startTime: prev[i]?.startTime ?? '',
        endTime: prev[i]?.endTime ?? '',
      }));
      return next;
    });
  }, [numDays]);

  function setValue(label: string, val: string) {
    setValues(v => ({ ...v, [label]: val }));
  }

  function buildPayload() {
    const canonical: Record<string, unknown> = { numDays };
    const customFields: Record<string, string> = {};

    for (const field of activeFields) {
      const val = values[field.label] ?? '';
      if (!val && field.label !== 'Event Name') continue;
      const dbKey = CANONICAL_LABEL_TO_DBKEY[field.label];
      if (dbKey) {
        canonical[dbKey] = val;
      } else {
        customFields[field.label] = val;
      }
    }

    if (Object.keys(customFields).length > 0) canonical['customFields'] = customFields;
    if (numDays > 1) canonical['days'] = days;

    return canonical;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values['Event Name']?.trim()) {
      showToast('Event Name is required', 'error');
      return;
    }
    setLoading(true);
    try {
      const input = buildPayload();
      if (isEdit && eventId) {
        await updateEvent({ variables: { id: eventId, input } });
        showToast('Event updated!', 'success');
        navigate(`/companies/${companyId}/events/${eventId}`);
      } else {
        const { data } = await createEvent({ variables: { companyId, input } });
        showToast('Event created!', 'success');
        navigate(`/companies/${companyId}/events/${data.createEvent.id}`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save event', 'error');
    } finally {
      setLoading(false);
    }
  }

  const squareLocations = setupData?.squareLocations ?? [];

  return (
    <div className="card" style={{ maxWidth: 700 }}>
      <h2 style={{ margin: '0 0 20px', color: 'var(--vv-navy)' }}>
        {isEdit ? 'Edit Event' : 'Add New Event'}
      </h2>

      <form onSubmit={handleSubmit}>
        {/* Square Location picker (Pro field) */}
        <div className="form-group">
          <label>Square Location</label>
          <select
            value={values['Square Location'] ?? ''}
            onChange={e => setValue('Square Location', e.target.value)}
          >
            <option value="">Select Square Location…</option>
            {squareLocations.map((loc: { id: string; name: string }) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          {squareLocations.length === 0 && (
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
              Connect Square in Settings to link a location for automatic sales sync.
            </p>
          )}
        </div>

        {/* Number of days */}
        <div className="form-group">
          <label>Number of Days</label>
          <input
            type="number"
            min={1}
            max={30}
            value={numDays}
            onChange={e => setNumDays(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: 80 }}
          />
        </div>

        {/* Per-day date/time inputs */}
        {numDays > 1 && days.map((d, i) => (
          <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', marginBottom: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 8 }}>Day {i + 1}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label>Date</label>
                <input type="date" value={d.eventDate} onChange={e => {
                  setDays(prev => prev.map((x, j) => j === i ? { ...x, eventDate: e.target.value } : x));
                }} />
              </div>
              <div>
                <label>Start Time</label>
                <input type="time" value={d.startTime} onChange={e => {
                  setDays(prev => prev.map((x, j) => j === i ? { ...x, startTime: e.target.value } : x));
                }} />
              </div>
              <div>
                <label>End Time</label>
                <input type="time" value={d.endTime} onChange={e => {
                  setDays(prev => prev.map((x, j) => j === i ? { ...x, endTime: e.target.value } : x));
                }} />
              </div>
            </div>
          </div>
        ))}

        {/* Dynamic form fields from template */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          {activeFields.map(field => {
            if (field.label === 'Square Location') return null;
            const isTextArea = field.type === 'textarea';
            const isSelect = field.type === 'select' || field.type === 'multiselect';
            return (
              <div
                key={field.label}
                className="form-group"
                style={isTextArea ? { gridColumn: '1 / -1' } : {}}
              >
                <label>
                  {field.label}
                  {field.required && <span style={{ color: '#dc2626' }}> *</span>}
                </label>

                {isTextArea && (
                  <textarea
                    value={values[field.label] ?? ''}
                    onChange={e => setValue(field.label, e.target.value)}
                    rows={3}
                    required={field.required}
                  />
                )}
                {isSelect && (
                  <select
                    value={values[field.label] ?? ''}
                    onChange={e => setValue(field.label, e.target.value)}
                    required={field.required}
                  >
                    <option value="">Select…</option>
                    {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
                {!isTextArea && !isSelect && (
                  <input
                    type={field.type}
                    value={values[field.label] ?? ''}
                    onChange={e => setValue(field.label, e.target.value)}
                    required={field.required}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading && <span className="spinner" />}
            <span>{isEdit ? 'Save Changes' : 'Create Event'}</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(isEdit ? `/companies/${companyId}/events/${eventId}` : `/companies/${companyId}/events`)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
