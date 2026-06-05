import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { showToast } from '@org/data';

const GET_RECIPES = gql`
  query GetRecipes($companyId: ID!) {
    recipes(companyId: $companyId) {
      id name totalCost
      ingredients { id name quantity unitCost unit }
    }
  }
`;
const CREATE_RECIPE = gql`
  mutation CreateRecipe($companyId: ID!, $input: CreateRecipeInput!) {
    createRecipe(companyId: $companyId, input: $input) { id name totalCost ingredients { id name quantity unitCost unit } }
  }
`;
const UPDATE_RECIPE = gql`
  mutation UpdateRecipe($id: ID!, $input: CreateRecipeInput!) {
    updateRecipe(id: $id, input: $input) { id name totalCost ingredients { id name quantity unitCost unit } }
  }
`;
const DELETE_RECIPE = gql`
  mutation DeleteRecipe($id: ID!) { deleteRecipe(id: $id) }
`;

interface Ingredient { id?: string; name: string; quantity: number; unitCost: number; unit: string; }
interface Recipe { id: string; name: string; totalCost: number; ingredients: Ingredient[]; }

const emptyIngredient = (): Ingredient => ({ name: '', quantity: 1, unitCost: 0, unit: '' });

export function RecipesPage() {
  const { companyId } = useCurrentCompany();
  const { data, loading, refetch } = useQuery(GET_RECIPES, { variables: { companyId }, skip: !companyId });
  const [createRecipe] = useMutation(CREATE_RECIPE);
  const [updateRecipe] = useMutation(UPDATE_RECIPE);
  const [deleteRecipe] = useMutation(DELETE_RECIPE);

  const [editing, setEditing] = useState<Recipe | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([emptyIngredient()]);
  const [saving, setSaving] = useState(false);

  const recipes: Recipe[] = data?.recipes ?? [];

  function openNew() {
    setIsNew(true);
    setEditing(null);
    setName('');
    setIngredients([emptyIngredient()]);
  }

  function openEdit(recipe: Recipe) {
    setIsNew(false);
    setEditing(recipe);
    setName(recipe.name);
    setIngredients(recipe.ingredients.length > 0 ? recipe.ingredients : [emptyIngredient()]);
  }

  function closeForm() { setEditing(null); setIsNew(false); }

  function updateIngredient(i: number, field: keyof Ingredient, value: string | number) {
    setIngredients(prev => prev.map((ing, j) => j === i ? { ...ing, [field]: value } : ing));
  }
  function addIngredient() { setIngredients(prev => [...prev, emptyIngredient()]); }
  function removeIngredient(i: number) { setIngredients(prev => prev.filter((_, j) => j !== i)); }

  const totalCost = ingredients.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0);

  async function handleSave() {
    if (!name.trim()) { showToast('Recipe name required', 'error'); return; }
    setSaving(true);
    const input = { name: name.trim(), ingredients: ingredients.filter(i => i.name.trim()).map(({ id: _id, ...i }) => ({ ...i, quantity: Number(i.quantity), unitCost: Number(i.unitCost) })) };
    try {
      if (isNew) {
        await createRecipe({ variables: { companyId, input } });
        showToast('Recipe created!', 'success');
      } else if (editing) {
        await updateRecipe({ variables: { id: editing.id, input } });
        showToast('Recipe updated!', 'success');
      }
      refetch();
      closeForm();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string, recipeName: string) {
    if (!confirm(`Delete "${recipeName}"?`)) return;
    try {
      await deleteRecipe({ variables: { id } });
      showToast('Recipe deleted', 'info');
      refetch();
    } catch { showToast('Failed to delete', 'error'); }
  }

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', color: 'var(--vv-navy)' }}>🍋 Recipes</h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.86rem' }}>
              Define ingredient costs for each dish. VenView uses these to calculate COGS automatically when you sync Square sales.
            </p>
          </div>
          <button className="btn-primary" onClick={openNew}>+ New Recipe</button>
        </div>

        {loading && <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Loading…</p>}
        {!loading && recipes.length === 0 && (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '32px 0', fontSize: '0.9rem' }}>
            No recipes yet. <a href="#" onClick={e => { e.preventDefault(); openNew(); }} style={{ color: 'var(--vv-navy)', fontWeight: 600 }}>Create your first recipe →</a>
          </p>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5 mt-3.5">
          {recipes.map(recipe => (
            <div key={recipe.id} className="bg-white border border-[rgba(11,42,74,0.12)] rounded-xl p-4 transition-shadow hover:shadow-[0_4px_12px_rgba(11,42,74,0.08)]">
              <div className="text-[0.97rem] font-bold text-[#0B2A4A] mb-1">{recipe.name}</div>
              <div className="text-[0.82rem] text-[#64748b]">${Number(recipe.totalCost).toFixed(4)}/batch · {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => openEdit(recipe)}>✏️ Edit</button>
                <button className="btn-danger-subtle" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => handleDelete(recipe.id, recipe.name)}>🗑</button>
              </div>
              {recipe.ingredients.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: '0.78rem', color: 'var(--muted)', cursor: 'pointer' }}>Ingredients ({recipe.ingredients.length})</summary>
                  <table style={{ width: '100%', fontSize: '0.8rem', marginTop: 6, borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '3px 6px' }}>Name</th>
                      <th style={{ textAlign: 'right', padding: '3px 6px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '3px 6px' }}>Unit Cost</th>
                      <th style={{ textAlign: 'right', padding: '3px 6px' }}>Total</th>
                    </tr></thead>
                    <tbody>
                      {recipe.ingredients.map((ing, i) => (
                        <tr key={i}>
                          <td style={{ padding: '3px 6px' }}>{ing.name}{ing.unit ? ` (${ing.unit})` : ''}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }}>{ing.quantity}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right' }}>${Number(ing.unitCost).toFixed(4)}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 600 }}>${(Number(ing.quantity) * Number(ing.unitCost)).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recipe form modal */}
      {(isNew || editing) && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal-box" style={{ maxWidth: 600 }}>
            <button className="modal-close" onClick={closeForm}>✕</button>
            <h3 style={{ margin: '0 0 16px' }}>{isNew ? 'New Recipe' : `Edit: ${editing?.name}`}</h3>

            <div className="form-group">
              <label>Recipe Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Lemon Drop Cocktail" autoFocus />
            </div>

            <div style={{ margin: '16px 0 10px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--vv-navy)' }}>
              Ingredients
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 70px 28px', gap: '6px 8px', fontSize: '0.84rem', marginBottom: 4 }}>
              <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Name</span>
              <span style={{ color: 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>Qty</span>
              <span style={{ color: 'var(--muted)', fontWeight: 600, textAlign: 'right' }}>Unit Cost</span>
              <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Unit</span>
              <span />
            </div>

            {ingredients.map((ing, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 70px 28px', gap: '4px 8px', marginBottom: 4 }}>
                <input type="text" value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} placeholder="Ingredient" />
                <input type="number" step="0.001" value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)} style={{ textAlign: 'right' }} />
                <input type="number" step="0.0001" value={ing.unitCost} onChange={e => updateIngredient(i, 'unitCost', e.target.value)} style={{ textAlign: 'right' }} />
                <input type="text" value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} placeholder="oz, g…" />
                <button onClick={() => removeIngredient(i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>✕</button>
              </div>
            ))}

            <button className="btn-secondary" style={{ fontSize: '0.82rem', padding: '5px 12px', marginTop: 6 }} onClick={addIngredient}>+ Add Ingredient</button>

            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', margin: '14px 0', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--muted)' }}>Estimated batch cost</span>
              <span style={{ fontWeight: 700, color: 'var(--vv-navy)' }}>${totalCost.toFixed(4)}</span>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving && <span className="spinner" />} Save Recipe
              </button>
              <button className="btn-secondary" onClick={closeForm}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
