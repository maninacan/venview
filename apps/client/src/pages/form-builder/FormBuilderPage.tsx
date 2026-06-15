import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { showToast } from '@org/data';

const GET_TEMPLATES = gql`
  query GetFormTemplates($companyId: ID!) {
    formTemplates(companyId: $companyId) { id templateName fields isActive }
  }
`;
const SAVE_TEMPLATE = gql`
  mutation SaveFormTemplate($companyId: ID!, $input: SaveFormTemplateInput!) {
    saveFormTemplate(companyId: $companyId, input: $input) { id templateName isActive }
  }
`;
const ACTIVATE_TEMPLATE = gql`
  mutation ActivateTemplate($companyId: ID!, $templateId: ID!) {
    activateFormTemplate(companyId: $companyId, templateId: $templateId)
  }
`;

interface FormField {
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'textarea';
  required: boolean;
  options?: string;
}

interface Template {
  id: string;
  templateName: string;
  fields: FormField[];
  isActive: boolean;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'textarea', label: 'Text Area' },
];

const REQUIRED_FIELDS = ['Event Name', 'Event Date', 'Zip Code'];

export function FormBuilderPage() {
  const { companyId } = useCurrentCompany();
  const { data, loading, refetch } = useQuery(GET_TEMPLATES, { variables: { companyId }, skip: !companyId });
  const [saveTemplate] = useMutation(SAVE_TEMPLATE);
  const [activateTemplate] = useMutation(ACTIVATE_TEMPLATE);

  const [templateName, setTemplateName] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [builderLabel, setBuilderLabel] = useState('');
  const [builderType, setBuilderType] = useState<FormField['type']>('text');
  const [builderRequired, setBuilderRequired] = useState(false);
  const [builderOptions, setBuilderOptions] = useState('');
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const templates: Template[] = (data?.formTemplates ?? []).map((t: Record<string, unknown>) => ({
    ...t,
    // Fields are always stored as a flat array; coerce from JSON scalar
    fields: Array.isArray(t['fields']) ? (t['fields'] as FormField[]) : [],
  }));

  function loadTemplate(id: string) {
    const tmpl = templates.find(t => t.id === id);
    if (!tmpl) return;
    setTemplateName(tmpl.templateName);
    // options is always string[] from the API; convert to comma-string for the builder input
    setFields(tmpl.fields.map(f => ({ ...f, options: Array.isArray(f.options) ? (f.options as unknown as string[]).join(', ') : '' })));
  }

  function useSelected() {
    if (selectedTemplateId) loadTemplate(selectedTemplateId);
  }

  function addField() {
    if (!builderLabel.trim()) { showToast('Field label required', 'error'); return; }
    const hasOptions = builderType === 'select' || builderType === 'multiselect';
    setFields(prev => [...prev, {
      label: builderLabel.trim(),
      type: builderType,
      required: builderRequired,
      options: hasOptions ? builderOptions : undefined,
    }]);
    setBuilderLabel('');
    setBuilderType('text');
    setBuilderRequired(false);
    setBuilderOptions('');
  }

  function removeField(i: number) {
    const field = fields[i];
    if (REQUIRED_FIELDS.includes(field.label)) { showToast(`"${field.label}" is required in all templates`, 'warning'); return; }
    setFields(prev => prev.filter((_, j) => j !== i));
  }

  function moveField(i: number, dir: -1 | 1) {
    const next = [...fields];
    const swap = i + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[i], next[swap]] = [next[swap], next[i]];
    setFields(next);
  }

  async function handleSave() {
    if (!templateName.trim()) { showToast('Template name required', 'error'); return; }

    // Validate required fields are present
    const missingRequired = REQUIRED_FIELDS.filter(r => !fields.some(f => f.label === r));
    if (missingRequired.length > 0) {
      showToast(`Missing required fields: ${missingRequired.join(', ')}`, 'warning', 5000);
      return;
    }

    setSaving(true);
    try {
      const serializedFields = fields.map(f => ({
        label: f.label,
        type: f.type,
        required: f.required,
        options: (f.type === 'select' || f.type === 'multiselect') && f.options
          ? f.options.split(',').map(o => o.trim()).filter(Boolean)
          : undefined,
      }));

      await saveTemplate({ variables: { companyId, input: { templateName: templateName.trim(), fields: serializedFields } } });
      showToast('Template saved!', 'success');
      setTemplateName('');
      setFields([]);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally { setSaving(false); }
  }

  async function handleActivate(templateId: string) {
    setActivatingId(templateId);
    try {
      await activateTemplate({ variables: { companyId, templateId } });
      showToast('Template activated! New events will use this form.', 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to activate', 'error');
    } finally { setActivatingId(null); }
  }

  function clearBuilder() {
    setTemplateName('');
    setFields([]);
    setBuilderLabel('');
    setBuilderOptions('');
  }

  const showOptions = builderType === 'select' || builderType === 'multiselect';

  return (
    <>
      <div className="card">
        <h2 style={{ margin: '0 0 4px', color: 'var(--vv-navy)' }}>🧩 Design Event Form</h2>
        <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: '0.86rem' }}>
          Create custom form templates for the Add Event screen. The active template determines which fields appear.
        </p>

        {/* Template loader */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>Load Existing Template</label>
            <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
              <option value="">— Select Template —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.templateName}{t.isActive ? ' ✅' : ''}</option>
              ))}
            </select>
          </div>
          <button className="btn-secondary" onClick={useSelected} disabled={!selectedTemplateId}><i className="fa-solid fa-bolt" /> Load</button>
        </div>

        {/* Required fields note */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: '0.8rem', color: '#92400e' }}>
          <strong>Required fields in every template:</strong> Event Name, Event Date, Zip Code
        </div>

        {/* Template name */}
        <div className="form-group">
          <label>Template Name</label>
          <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Farmers Market, Festival, Catering" style={{ maxWidth: 320 }} />
        </div>

        {/* Field builder controls */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--vv-navy)', marginBottom: 10 }}>Add a Field</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: 2, minWidth: 160 }}>
              <label>Field Label</label>
              <input type="text" value={builderLabel} onChange={e => setBuilderLabel(e.target.value)} placeholder="e.g. Event Name" onKeyDown={e => e.key === 'Enter' && addField()} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Type</label>
              <select value={builderType} onChange={e => setBuilderType(e.target.value as FormField['type'])}>
                {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" id="builderRequired" checked={builderRequired} onChange={e => setBuilderRequired(e.target.checked)} />
              <label htmlFor="builderRequired" style={{ marginBottom: 0 }}>Required</label>
            </div>
            {showOptions && (
              <div className="form-group" style={{ margin: 0, flex: 2, minWidth: 180 }}>
                <label>Options (comma-separated)</label>
                <input type="text" value={builderOptions} onChange={e => setBuilderOptions(e.target.value)} placeholder="e.g. Red, Green, Blue" />
              </div>
            )}
            <button className="btn-primary" onClick={addField} style={{ marginBottom: 0 }}><i className="fa-solid fa-plus" /> Add Field</button>
          </div>
        </div>

        {/* Preview */}
        {fields.length > 0 && (
          <>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 10, color: 'var(--vv-navy)' }}>
              Preview ({fields.length} field{fields.length !== 1 ? 's' : ''})
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              {fields.map((field, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderBottom: i < fields.length - 1 ? '1px solid #f1f5f9' : undefined,
                    background: i % 2 === 0 ? '#fff' : '#fafafa',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{field.label}</span>
                    {field.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                    <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: 99, color: 'var(--muted)' }}>{field.type}</span>
                    {field.options && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--muted)' }}>[{field.options}]</span>}
                    {REQUIRED_FIELDS.includes(field.label) && <span style={{ marginLeft: 6, fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: 99 }}>required</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => moveField(i, -1)} disabled={i === 0} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, width: 24, height: 24, cursor: i === 0 ? 'not-allowed' : 'pointer', color: 'var(--muted)', fontSize: '0.75rem' }}>↑</button>
                    <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, width: 24, height: 24, cursor: i === fields.length - 1 ? 'not-allowed' : 'pointer', color: 'var(--muted)', fontSize: '0.75rem' }}>↓</button>
                    <button onClick={() => removeField(i)} disabled={REQUIRED_FIELDS.includes(field.label)} style={{ background: 'none', border: 'none', color: REQUIRED_FIELDS.includes(field.label) ? '#ccc' : '#dc2626', cursor: REQUIRED_FIELDS.includes(field.label) ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}><i className="fa-solid fa-xmark" /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving && <span className="spinner" />} <i className="fa-solid fa-floppy-disk" /> Save Template
          </button>
          <button className="btn-secondary" onClick={clearBuilder}><i className="fa-solid fa-broom" /> Clear</button>
        </div>
      </div>

      {/* Saved Templates */}
      {!loading && templates.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 14px', color: 'var(--vv-navy)' }}>Saved Templates</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {templates.map(tmpl => (
              <div key={tmpl.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: tmpl.isActive ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: `1px solid ${tmpl.isActive ? '#bbf7d0' : 'var(--border)'}` }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tmpl.templateName}</span>
                  {tmpl.isActive && <span style={{ marginLeft: 8, fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>ACTIVE</span>}
                  <span style={{ marginLeft: 8, fontSize: '0.78rem', color: 'var(--muted)' }}>{tmpl.fields.length} fields</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => { loadTemplate(tmpl.id); window.scrollTo(0, 0); }}><i className="fa-solid fa-pen-to-square" /> Edit</button>
                  {!tmpl.isActive && (
                    <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} disabled={activatingId === tmpl.id} onClick={() => handleActivate(tmpl.id)}>
                      {activatingId === tmpl.id && <span className="spinner" />} <i className="fa-solid fa-bolt" /> Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
