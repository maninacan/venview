import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { showToast } from '@org/data';

const CREATE_COMPANY = gql`
  mutation CreateCompany($input: CreateCompanyInput!) {
    createCompany(input: $input) { id name }
  }
`;

// Common country dialing codes. `iso` is the unique option key (US/CA share +1).
const COUNTRY_CODES = [
  { iso: 'US', flag: '🇺🇸', dial: '+1', name: 'United States' },
  { iso: 'CA', flag: '🇨🇦', dial: '+1', name: 'Canada' },
  { iso: 'MX', flag: '🇲🇽', dial: '+52', name: 'Mexico' },
  { iso: 'GB', flag: '🇬🇧', dial: '+44', name: 'United Kingdom' },
  { iso: 'AU', flag: '🇦🇺', dial: '+61', name: 'Australia' },
  { iso: 'DE', flag: '🇩🇪', dial: '+49', name: 'Germany' },
  { iso: 'FR', flag: '🇫🇷', dial: '+33', name: 'France' },
  { iso: 'ES', flag: '🇪🇸', dial: '+34', name: 'Spain' },
  { iso: 'IT', flag: '🇮🇹', dial: '+39', name: 'Italy' },
  { iso: 'NL', flag: '🇳🇱', dial: '+31', name: 'Netherlands' },
  { iso: 'IE', flag: '🇮🇪', dial: '+353', name: 'Ireland' },
  { iso: 'BR', flag: '🇧🇷', dial: '+55', name: 'Brazil' },
  { iso: 'IN', flag: '🇮🇳', dial: '+91', name: 'India' },
  { iso: 'JP', flag: '🇯🇵', dial: '+81', name: 'Japan' },
  { iso: 'CN', flag: '🇨🇳', dial: '+86', name: 'China' },
  { iso: 'NZ', flag: '🇳🇿', dial: '+64', name: 'New Zealand' },
  { iso: 'ZA', flag: '🇿🇦', dial: '+27', name: 'South Africa' },
];

export function CreateCompanyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', contactName: '', vendorCategory: '', email: '' });
  const [countryCode, setCountryCode] = useState('+1');
  const [loading, setLoading] = useState(false);

  const [createCompany] = useMutation(CREATE_COMPANY);

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      // Prepend the selected country code to the number (only if one was entered).
      const trimmedPhone = form.phone.trim();
      const phone = trimmedPhone ? `${countryCode} ${trimmedPhone}` : '';
      const { data } = await createCompany({
        variables: { input: { ...form, name: form.name.trim(), phone } },
      });
      showToast(`Company "${data.createCompany.name}" created!`, 'success');
      navigate(`/companies/${data.createCompany.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create company', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--vv-navy)', marginBottom: 4 }}>
          Register Your Company
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: 24 }}>
          Set up your food truck or vendor business on venOS.
        </p>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Company Name *</label>
              <input
                type="text"
                placeholder="e.g. Lemon Drip Food Co."
                value={form.name}
                onChange={e => update('name', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Vendor Category</label>
              <input
                type="text"
                placeholder="e.g. Food Truck, Catering, Farmers Market"
                value={form.vendorCategory}
                onChange={e => update('vendorCategory', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Contact Name</label>
              <input
                type="text"
                placeholder="Owner / contact name"
                value={form.contactName}
                onChange={e => update('contactName', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  aria-label="Country code"
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value)}
                  style={{ width: 150, flexShrink: 0 }}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.iso} value={c.dial}>
                      {c.flag} {c.dial} {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="contact@yourcompany.com"
                value={form.email}
                onChange={e => update('email', e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading && <span className="spinner" />}
                <span>Create Company</span>
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate('/companies')}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
