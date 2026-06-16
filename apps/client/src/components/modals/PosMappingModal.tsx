import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { showToast } from '@org/data';

const GET_DATA = gql`
  query GetPosMappingData($companyId: ID!) {
    squareCatalog(companyId: $companyId) { posItemId posItemName variationName price }
    inventory(companyId: $companyId) { id name unitCost }
    posMappings(companyId: $companyId) { posItemId inventoryItemId }
  }
`;
const SAVE_MAPPINGS = gql`
  mutation SavePosMappings($companyId: ID!, $mappings: [PosMappingInput!]!) {
    savePosMappings(companyId: $companyId, mappings: $mappings)
  }
`;

interface CatalogItem { posItemId: string; posItemName: string; variationName?: string | null; price?: number | null; }
interface InventoryItem { id: string; name: string; unitCost: number; }
interface Mapping { posItemId: string; inventoryItemId: string | null; suggested?: boolean; }

// Name similarity scorer — ported exactly from old app
const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'for', 'with']);

function tokenize(str: string): Set<string> {
  return new Set(
    str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w))
  );
}

function scoreNameMatch(catalogItem: CatalogItem, inventoryName: string): number {
  const searchStr = catalogItem.variationName && catalogItem.variationName.toLowerCase() !== 'regular'
    ? `${catalogItem.posItemName} ${catalogItem.variationName}`
    : catalogItem.posItemName;
  const squareTokens = tokenize(searchStr);
  const invTokens = tokenize(inventoryName);
  if (!squareTokens.size || !invTokens.size) return 0;

  let overlap = 0;
  for (const t of squareTokens) { if (invTokens.has(t)) overlap++; }

  const variation = (catalogItem.variationName ?? '').toLowerCase().trim();
  if (variation && variation !== 'regular' && inventoryName.toLowerCase().includes(variation)) {
    overlap += 1.5;
  }
  return overlap / Math.max(squareTokens.size, invTokens.size);
}

function suggestMatch(catalogItem: CatalogItem, inventoryItems: InventoryItem[]): string | null {
  let best: { id: string; score: number } | null = null;
  for (const inv of inventoryItems) {
    const score = scoreNameMatch(catalogItem, inv.name);
    if (!best || score > best.score) best = { id: inv.id, score };
  }
  return best && best.score >= 0.45 ? best.id : null;
}

interface Props {
  companyId: string;
  onClose: () => void;
}

export function PosMappingModal({ companyId, onClose }: Props) {
  const { data, loading } = useQuery(GET_DATA, { variables: { companyId } });
  const [saveMappings] = useMutation(SAVE_MAPPINGS);
  const [mappings, setMappings] = useState<Map<string, Mapping>>(new Map());
  const [saving, setSaving] = useState(false);

  const catalogItems: CatalogItem[] = data?.squareCatalog ?? [];
  const inventoryItems: InventoryItem[] = data?.inventory ?? [];
  const existingMaps: Array<{ posItemId: string; inventoryItemId: string }> = data?.posMappings ?? [];

  // Initialize mappings: saved first, then auto-suggest for unmapped
  useEffect(() => {
    if (!data) return;
    const m = new Map<string, Mapping>();
    const savedMap = new Map(existingMaps.map(e => [e.posItemId, e.inventoryItemId]));

    for (const item of catalogItems) {
      const saved = savedMap.get(item.posItemId);
      if (saved !== undefined) {
        m.set(item.posItemId, { posItemId: item.posItemId, inventoryItemId: saved, suggested: false });
      } else {
        const suggestion = suggestMatch(item, inventoryItems);
        m.set(item.posItemId, { posItemId: item.posItemId, inventoryItemId: suggestion, suggested: !!suggestion });
      }
    }
    setMappings(m);
  }, [data]); // eslint-disable-line

  function setMapping(posItemId: string, inventoryItemId: string | null) {
    setMappings(prev => {
      const next = new Map(prev);
      next.set(posItemId, { posItemId, inventoryItemId, suggested: false });
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const mapsArray = Array.from(mappings.values()).map(m => ({
        posSystem: 'square',
        posItemId: m.posItemId,
        posItemName: catalogItems.find(c => c.posItemId === m.posItemId)?.posItemName ?? '',
        variationName: catalogItems.find(c => c.posItemId === m.posItemId)?.variationName,
        inventoryId: m.inventoryItemId,
      }));
      await saveMappings({ variables: { companyId, mappings: mapsArray } });
      showToast('✅ Mappings saved! Cost calculations are now accurate.', 'success', 5000);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally { setSaving(false); }
  }

  const unmappedCount = Array.from(mappings.values()).filter(m => !m.inventoryItemId).length;
  const suggestedCount = Array.from(mappings.values()).filter(m => m.suggested && m.inventoryItemId).length;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 720, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', margin: '40px 16px' }}>
        {/* Header */}
        <div style={{ padding: '22px 26px 14px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 700, color: 'var(--vv-navy)' }}>
            Match Your Square Menu to Your Recipe Cards
          </h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            Map each Square item to an inventory item once — VenView calculates costs automatically every sync. Use <em>"Not in my menu"</em> for tips, misc charges, etc.
          </p>
        </div>

        {/* Auto-suggest legend */}
        {suggestedCount > 0 && (
          <div style={{ padding: '8px 26px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: '0.8rem', color: '#78350f' }}>
            ✨ <strong>{suggestedCount} item(s)</strong> were auto-matched by name — marked <span style={{ background: '#fef3c7', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>suggested</span>. Review before saving.
          </div>
        )}

        {/* Unmapped warning */}
        {unmappedCount > 0 && (
          <div style={{ padding: '8px 26px', background: '#fff7ed', borderBottom: '1px solid #fed7aa', fontSize: '0.8rem', color: '#c2410c' }}>
            ⚠️ <strong>{unmappedCount} item(s)</strong> have no recipe card — COGS will show as $0 for those.
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <span className="spinner spinner-dark" style={{ width: 24, height: 24, borderWidth: 2 }} />
          </div>
        ) : catalogItems.length === 0 ? (
          <div style={{ padding: '24px 26px', color: 'var(--muted)', fontSize: '0.88rem' }}>
            No Square catalog items found. Make sure Square is connected and has items.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', maxHeight: 400 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb', width: '45%' }}>Square Item</th>
                  <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>Your Inventory Item</th>
                </tr>
              </thead>
              <tbody>
                {catalogItems.map(item => {
                  const mapping = mappings.get(item.posItemId);
                  const isSuggested = mapping?.suggested ?? false;
                  const displayLabel = item.variationName && item.variationName.toLowerCase() !== 'regular'
                    ? `${item.posItemName} — ${item.variationName}`
                    : item.posItemName;

                  return (
                    <tr key={item.posItemId}>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f0f0', fontSize: '0.87rem', color: '#333' }}>
                        {displayLabel}
                      </td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <select
                            value={mapping?.inventoryItemId ?? ''}
                            onChange={e => setMapping(item.posItemId, e.target.value || null)}
                            style={{
                              flex: 1, padding: '5px 8px',
                              border: isSuggested ? '1.5px solid #f59e0b' : '1px solid #d1d5db',
                              borderRadius: 6, fontSize: '0.83rem',
                              background: isSuggested ? '#fffbeb' : '#fff',
                            }}
                          >
                            <option value="">— Not in my menu —</option>
                            {inventoryItems.map(inv => (
                              <option key={inv.id} value={inv.id}>{inv.name} (${Number(inv.unitCost).toFixed(4)}/unit)</option>
                            ))}
                          </select>
                          {isSuggested && (
                            <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 99, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>suggested</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '14px 26px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fff' }}>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving && <span className="spinner" />} <span>Save Mappings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
