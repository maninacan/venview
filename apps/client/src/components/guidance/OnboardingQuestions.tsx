import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { showToast } from '@org/data';

const SET_PROFILE = gql`
  mutation SetCompanyProfile($companyId: ID!, $posSystem: String, $laborMethod: String) {
    setCompanyProfile(companyId: $companyId, posSystem: $posSystem, laborMethod: $laborMethod) { id posSystem laborMethod }
  }
`;

const POS_OPTIONS = [
  { value: 'square', label: 'Square', disabled: false },
  { value: 'manual', label: 'No POS / manual', disabled: false },
  { value: 'shopify', label: 'Shopify', disabled: true },
  { value: 'toast', label: 'Toast', disabled: true },
];

const LABOR_OPTIONS = [
  { value: 'pos', label: 'From my POS system' },
  { value: 'other', label: 'Another method (manual entry)' },
  { value: 'flat_rate', label: 'Flat rate per shift' },
];

// Two-question onboarding mini-form shown on Home until answered. Personalizes
// the setup checklist and stores the answers on the company.
export function OnboardingQuestions({ companyId, onSaved, onSkip }: {
  companyId: string;
  onSaved: () => void;
  onSkip: () => void;
}) {
  const [pos, setPos] = useState('');
  const [labor, setLabor] = useState('');
  const [saving, setSaving] = useState(false);
  const [setProfile] = useMutation(SET_PROFILE);

  async function save() {
    if (!pos || !labor) { showToast('Please answer both questions', 'warning'); return; }
    setSaving(true);
    try {
      await setProfile({ variables: { companyId, posSystem: pos, laborMethod: labor } });
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save answers', 'error');
    } finally { setSaving(false); }
  }

  const pill = (active: boolean, disabled?: boolean) =>
    `px-3.5 py-2 rounded-full text-[0.85rem] font-semibold border cursor-pointer transition-colors ${
      disabled ? 'opacity-40 cursor-not-allowed border-[#e2e8f0] text-[#94a3b8]'
      : active ? 'bg-[#0B2A4A] text-white border-[#0B2A4A]'
      : 'bg-white text-[#0B2A4A] border-[rgba(11,42,74,0.2)] hover:bg-[#f1f5f9]'}`;

  return (
    <div className="bg-white rounded-xl border border-[rgba(11,42,74,0.12)] mb-4 shadow-[0_4px_12px_rgba(11,42,74,0.08)] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="m-0 text-[1.05rem] font-bold text-[#0B2A4A]">Quick setup</h3>
          <p className="m-0 text-[0.84rem] text-[#64748b]">Two questions so we can tailor venOS to how you work.</p>
        </div>
        <button onClick={onSkip} className="text-[0.78rem] text-[#64748b] bg-transparent border-0 cursor-pointer shrink-0">Skip</button>
      </div>

      <div className="mb-4">
        <div className="text-[0.88rem] font-semibold text-[#0B2A4A] mb-2">Do you use a Point of Sale system?</div>
        <div className="flex flex-wrap gap-2">
          {POS_OPTIONS.map(o => (
            <button key={o.value} disabled={o.disabled} onClick={() => !o.disabled && setPos(o.value)} className={pill(pos === o.value, o.disabled)}>
              {o.label}{o.disabled ? ' (soon)' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[0.88rem] font-semibold text-[#0B2A4A] mb-2">How do you calculate labor?</div>
        <div className="flex flex-wrap gap-2">
          {LABOR_OPTIONS.map(o => (
            <button key={o.value} onClick={() => setLabor(o.value)} className={pill(labor === o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={save} disabled={saving || !pos || !labor}>
        {saving && <span className="spinner" />} <span>Save &amp; continue</span>
      </button>
    </div>
  );
}
