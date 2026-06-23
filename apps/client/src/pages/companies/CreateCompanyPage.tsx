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

export function CreateCompanyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', contactName: '', vendorCategory: '', email: '' });
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
      const { data } = await createCompany({
        variables: { input: { ...form, name: form.name.trim() } },
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
              <input
                type="text"
                placeholder="(555) 555-5555"
                value={form.phone}
                onChange={e => update('phone', e.target.value)}
              />
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
