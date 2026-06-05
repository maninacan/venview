import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { showToast } from '@org/data';

const GET_INVENTORY = gql`
  query GetInventory($companyId: ID!) {
    inventory(companyId: $companyId) {
      id name category unitCost quantityOnHand reorderThreshold sku
    }
  }
`;
const UPDATE_ITEM = gql`
  mutation UpdateInventoryItem($id: ID!, $input: UpdateInventoryItemInput!) {
    updateInventoryItem(id: $id, input: $input) { id name unitCost quantityOnHand reorderThreshold }
  }
`;
const DELETE_ITEM = gql`
  mutation DeleteInventoryItem($id: ID!) { deleteInventoryItem(id: $id) }
`;
const CLEAR_ALL = gql`
  mutation ClearInventory($companyId: ID!) { clearInventory(companyId: $companyId) }
`;

interface InventoryItem {
  id: string;
  name: string;
  category?: string | null;
  unitCost: number;
  quantityOnHand?: number | null;
  reorderThreshold?: number | null;
  sku?: string | null;
}

const API_URL = (import.meta.env['VITE_API_URL'] as string) || 'http://localhost:3000';

export function InventoryPage() {
  const { companyId } = useCurrentCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, loading, refetch } = useQuery(GET_INVENTORY, { variables: { companyId }, skip: !companyId });
  const [updateItem] = useMutation(UPDATE_ITEM);
  const [deleteItem] = useMutation(DELETE_ITEM);
  const [clearAll] = useMutation(CLEAR_ALL);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('No file chosen');

  const items: InventoryItem[] = data?.inventory ?? [];
  const categories = [...new Set(items.map(i => i.category).filter(Boolean) as string[])].sort();

  const filtered = items.filter(item => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setEditVals({
      name: item.name,
      category: item.category ?? '',
      unitCost: String(item.unitCost),
      quantityOnHand: String(item.quantityOnHand ?? 0),
      reorderThreshold: String(item.reorderThreshold ?? 0),
      sku: item.sku ?? '',
    });
  }

  async function saveEdit(id: string) {
    try {
      await updateItem({
        variables: {
          id,
          input: {
            name: editVals['name'],
            category: editVals['category'] || null,
            unitCost: parseFloat(editVals['unitCost']) || 0,
            quantityOnHand: parseFloat(editVals['quantityOnHand']) || 0,
            reorderThreshold: parseFloat(editVals['reorderThreshold']) || 0,
            sku: editVals['sku'] || null,
          },
        },
      });
      setEditingId(null);
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return;
    await deleteItem({ variables: { id } });
    refetch();
  }

  async function handleClearAll() {
    if (!confirm('Delete ALL inventory items? This cannot be undone.')) return;
    await clearAll({ variables: { companyId } });
    showToast('Inventory cleared', 'info');
    refetch();
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) { showToast('Select a CSV file first', 'error'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('companyId', companyId!);

      const { supabase } = await import('@org/data');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_URL}/api/uploads/inventory-csv`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const result = await res.json() as { success?: boolean; imported?: number; error?: string };
      if (!res.ok || !result.success) throw new Error(result.error ?? 'Upload failed');
      showToast(`✅ Imported ${result.imported} items!`, 'success', 5000);
      refetch();
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileName('No file chosen');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally { setUploading(false); }
  }

  function downloadTemplate() {
    const csv = 'itemName,category,unitCost,quantityOnHand,reorderThreshold,sku\nLemon Syrup,Syrups,3.50,10,2,SYR-001\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'inventory_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="card">
        <div className="mb-4">
          <h2 className="mt-0 mb-1 text-[#0B2A4A]">📦 My Inventory</h2>
          <p className="text-[#64748b] text-[0.86rem] m-0">Upload your product catalog once — VenView tracks stock and calculates COGS automatically after every Square sync.</p>
        </div>

        <div className="flex flex-wrap gap-2.5 mb-3.5 justify-between items-center">
          <div className="flex gap-2 items-center flex-wrap">
            <label className="bg-[#f1f5f9] border border-[#dde3f0] rounded-[7px] px-[13px] py-[7px] text-[0.85rem] cursor-pointer whitespace-nowrap">
              Choose CSV
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => setFileName(e.target.files?.[0]?.name ?? 'No file chosen')}
              />
            </label>
            <span className="text-[0.82rem] text-[#64748b]">{fileName}</span>
            <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
              {uploading && <span className="spinner" />} ⬆ Upload
            </button>
            <button className="btn-secondary" onClick={downloadTemplate}>⬇ Download Template</button>
            <button className="btn-danger" onClick={handleClearAll}>🗑 Clear All</button>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input type="text" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 180 }} />
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ width: 150 }}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {loading && <p className="text-[#64748b] text-[0.88rem]">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-[#64748b] text-[0.86rem] py-8 text-center">
            {items.length === 0
              ? 'No inventory items yet — upload a CSV or items will appear here.'
              : 'No items match your search.'}
          </p>
        )}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border)' }}>Item</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border)' }}>Category</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border)' }}>Unit Cost</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border)' }}>On Hand</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border)' }}>Reorder At</th>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid var(--border)' }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const isEditing = editingId === item.id;
                  const isLow = (item.reorderThreshold ?? 0) > 0 && (item.quantityOnHand ?? 0) <= (item.reorderThreshold ?? 0);
                  return (
                    <tr key={item.id} style={{ background: isLow ? '#fffbeb' : undefined }}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                        {isEditing
                          ? <input type="text" value={editVals['name']} onChange={e => setEditVals(v => ({ ...v, name: e.target.value }))} style={{ width: '100%' }} />
                          : <><strong>{item.name}</strong>{isLow && <span style={{ marginLeft: 6, fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 99 }}>LOW</span>}</>}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                        {isEditing
                          ? <input type="text" value={editVals['category']} onChange={e => setEditVals(v => ({ ...v, category: e.target.value }))} style={{ width: 110 }} />
                          : item.category ?? '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                        {isEditing
                          ? <input type="number" step="0.0001" value={editVals['unitCost']} onChange={e => setEditVals(v => ({ ...v, unitCost: e.target.value }))} style={{ width: 80, textAlign: 'right' }} />
                          : `$${Number(item.unitCost).toFixed(4)}`}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                        {isEditing
                          ? <input type="number" step="0.01" value={editVals['quantityOnHand']} onChange={e => setEditVals(v => ({ ...v, quantityOnHand: e.target.value }))} style={{ width: 70, textAlign: 'right' }} />
                          : Number(item.quantityOnHand ?? 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                        {isEditing
                          ? <input type="number" step="0.01" value={editVals['reorderThreshold']} onChange={e => setEditVals(v => ({ ...v, reorderThreshold: e.target.value }))} style={{ width: 70, textAlign: 'right' }} />
                          : Number(item.reorderThreshold ?? 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '3px 8px' }} onClick={() => saveEdit(item.id)}>Save</button>
                            <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '3px 8px' }} onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '3px 8px' }} onClick={() => startEdit(item)}>✏️</button>
                            <button className="btn-danger-subtle" style={{ fontSize: '0.78rem', padding: '3px 8px' }} onClick={() => handleDelete(item.id)}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '8px 0 0', textAlign: 'right' }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    </>
  );
}
