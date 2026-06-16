import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase.js';
import { createContext } from '../context/index.js';

// pdf-parse ships CJS-only; require() works fine since this project builds as CJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const RECIPE_EXTRACT_PROMPT = `You are a recipe data extraction assistant. Extract every recipe and all its ingredients from the provided content.

The content may arrive in any format — CSV, spreadsheet text, PDF, plain text, menu, recipe card, or an image/photo. Adapt your reading strategy to whatever you receive.

STEP 1 — Understand the layout.
- CSV / spreadsheet text: mentally reconstruct the 2-D grid (each line = a row, each comma-separated value = a cell). Recipes may be stacked vertically one after another, or arranged side-by-side in columns across the grid. Trailing empty cells are padding — ignore them.
- PDF / plain text / menu: identify recipe sections by name headings and ingredient lists beneath them.
- Image / photo: identify every recipe and ingredient list visible in the image.

STEP 2 — Find ALL recipe blocks.
A recipe block = a name + a list of ingredients. Scan the entire content — do not stop after the first recipe. Common signals for a recipe name: a standalone label before ingredient rows, a bold or larger heading, a cell with only a drink/dish name.

STEP 3 — For each recipe, extract ALL ingredient rows.
Skip these rows entirely — they are NOT ingredients:
  • Column-header rows: "Ingredient Name", "Quantity", "Unit", "Cost", "Unit Cost", or similar labels
  • Summary/total rows: any row starting with "Cost Per Drink", "Cost Per Item", "Total", "Subtotal", "Cost Per Serving", or similar
  • Blank rows

STEP 4 — Output.
Return ONLY a raw JSON object — no markdown fences, no explanation, no surrounding text:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "ingredients": [
        { "name": "ingredient name", "quantity": 1.0, "unit": "oz", "unitCost": 0.25 }
      ]
    }
  ]
}

Rules:
- Strip currency symbols from costs ("$0.25" → 0.25). If cost is missing or unclear, use 0.
- If quantity is missing, use 1. If unit is missing, use "".
- Recipe names should be clean and properly capitalized.
- Return an empty recipes array if no recipes are found.`;

// ── POST /api/uploads/inventory-csv ──────────────────────────────────────────
router.post('/uploads/inventory-csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const ctx = await createContext(req);
    if (!ctx.user) return void res.status(401).json({ error: 'Unauthorized' });

    const companyId = req.body['companyId'] as string;
    if (!companyId) return void res.status(400).json({ error: 'companyId required' });

    const file = req.file;
    if (!file) return void res.status(400).json({ error: 'No file uploaded' });

    // Verify membership
    const { data: member } = await supabase
      .from('CompanyMembers')
      .select('role')
      .eq('companyId', companyId)
      .eq('userId', ctx.user.id)
      .single();
    if (!member) return void res.status(403).json({ error: 'Forbidden' });

    // Parse CSV from buffer
    const text = file.buffer.toString('utf-8');
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return void res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

    const rows: Array<Record<string, unknown>> = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      if (vals.length === 0) continue;

      const row: Record<string, unknown> = { companyId, updatedAt: new Date().toISOString() };
      headers.forEach((h, idx) => {
        const val = vals[idx]?.trim() ?? '';
        if (h === 'itemname' || h === 'name') row['itemName'] = val;
        else if (h === 'category') row['category'] = val || null;
        else if (h === 'unitcost' || h === 'cost') row['unitCost'] = parseFloat(val) || 0;
        else if (h === 'quantityonhand' || h === 'quantity' || h === 'qty') row['quantityOnHand'] = parseFloat(val) || 0;
        else if (h === 'reorderthreshold' || h === 'threshold' || h === 'reorder') row['reorderThreshold'] = parseFloat(val) || 0;
        else if (h === 'sku') row['sku'] = val || null;
      });

      if (!row['itemName']) continue;
      rows.push(row);
    }

    if (rows.length === 0) return void res.status(400).json({ error: 'No valid rows found in CSV' });

    // Upsert by itemName within company
    const { error } = await supabase.from('VendorInventory').upsert(rows, { onConflict: 'companyId,itemName' });
    if (error) throw new Error(error.message);

    res.json({ success: true, imported: rows.length });
  } catch (err) {
    console.error('CSV upload error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

// ── POST /api/uploads/recipes-ai ─────────────────────────────────────────────
router.post('/uploads/recipes-ai', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const ctx = await createContext(req);
    if (!ctx.user) return void res.status(401).json({ error: 'Unauthorized' });

    const companyId = req.body['companyId'] as string;
    if (!companyId) return void res.status(400).json({ error: 'companyId required' });

    const file = req.file;
    if (!file) return void res.status(400).json({ error: 'No file uploaded' });

    const { data: member } = await supabase
      .from('CompanyMembers')
      .select('role')
      .eq('companyId', companyId)
      .eq('userId', ctx.user.id)
      .single();
    if (!member) return void res.status(403).json({ error: 'Forbidden' });

    const anthropic = new Anthropic();
    const mime = file.mimetype;
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    const isImage = mime.startsWith('image/');

    type UserContent = string | Anthropic.MessageParam['content'];
    let userContent: UserContent;
    let extractedText = '';

    if (isImage) {
      const validImageMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
      type ValidImageMime = typeof validImageMime[number];
      const mediaMime: ValidImageMime = validImageMime.includes(mime as ValidImageMime)
        ? (mime as ValidImageMime)
        : 'image/jpeg';

      userContent = [{
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: mediaMime, data: file.buffer.toString('base64') },
      }];
    } else {
      let text: string;

      if (mime === 'application/pdf' || ext === 'pdf') {
        const parsed = await pdfParse(file.buffer);
        text = parsed.text;
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mime === 'application/vnd.ms-excel' ||
        ext === 'xlsx' || ext === 'xls'
      ) {
        const wb = XLSX.read(file.buffer);
        const ws = wb.Sheets[wb.SheetNames[0]];
        text = XLSX.utils.sheet_to_csv(ws);
      } else {
        text = file.buffer.toString('utf-8');
      }

      if (!text.trim()) return void res.status(400).json({ error: 'Could not extract text from file' });

      // Strip trailing empty columns from each row (Google Sheets exports ~87 trailing commas)
      text = text.split('\n').map(row => {
        const cols = row.split(',');
        let last = cols.length - 1;
        while (last >= 0 && !cols[last].trim().replace(/^"|"$/g, '')) last--;
        return cols.slice(0, last + 1).join(',');
      }).filter(row => row.trim()).join('\n');

      extractedText = text;
      userContent = text;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const textRows = extractedText.split('\n');
    const CHUNK_ROWS = 350;
    const CHUNK_OVERLAP = 30;

    if (!isImage && textRows.length > CHUNK_ROWS) {
      // Large file: split into overlapping chunks so recipe blocks at boundaries
      // appear in both adjacent chunks, then deduplicate by recipe name.
      type RecipeIngredient = { name: string; quantity: number; unit: string; unitCost: number };
      type RecipeData = { name: string; ingredients: RecipeIngredient[] };

      const chunks: string[] = [];
      for (let i = 0; i < textRows.length; i += CHUNK_ROWS) {
        const start = i === 0 ? 0 : i - CHUNK_OVERLAP;
        const end = Math.min(textRows.length, i + CHUNK_ROWS);
        const chunk = textRows.slice(start, end).join('\n').trim();
        if (chunk) chunks.push(chunk);
      }

      // Map keyed by recipe name; on conflict keep the entry with more ingredients
      const recipeMap = new Map<string, RecipeData>();

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        res.write(`Processing section ${chunkIdx + 1} of ${chunks.length}...\n`);
        try {
          const chunkStream = anthropic.messages.stream({
            model: 'claude-opus-4-8',
            max_tokens: 32000,
            system: RECIPE_EXTRACT_PROMPT,
            messages: [{ role: 'user', content: chunks[chunkIdx] }],
          });
          const rawText = await chunkStream.finalText();
          const cleaned = rawText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
          const jStart = cleaned.indexOf('{');
          const jEnd = cleaned.lastIndexOf('}');
          if (jStart >= 0 && jEnd > jStart) {
            const parsed = JSON.parse(cleaned.slice(jStart, jEnd + 1)) as { recipes?: RecipeData[] };
            for (const r of parsed.recipes ?? []) {
              const key = r.name.toLowerCase().trim();
              const existing = recipeMap.get(key);
              if (!existing || r.ingredients.length > existing.ingredients.length) {
                recipeMap.set(key, r);
              }
            }
            res.write(`  Found ${(parsed.recipes ?? []).length} recipes.\n`);
          }
        } catch (chunkErr) {
          console.error(`Chunk ${chunkIdx + 1} error:`, chunkErr);
          res.write(`  Warning: could not fully process section ${chunkIdx + 1}.\n`);
        }
      }

      const allRecipes = Array.from(recipeMap.values());
      res.write(`\nDone — ${allRecipes.length} recipes extracted.\n\n`);
      res.write(JSON.stringify({ recipes: allRecipes }));
    } else {
      const stream = anthropic.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 32000,
        system: RECIPE_EXTRACT_PROMPT,
        messages: [{ role: 'user', content: userContent as Anthropic.MessageParam['content'] }],
      });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          res.write(event.delta.text);
        }
      }
    }

    res.end();
  } catch (err) {
    console.error('Recipe AI upload error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

// ── POST /api/uploads/permit ──────────────────────────────────────────────────
router.post('/uploads/permit', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const ctx = await createContext(req);
    if (!ctx.user) return void res.status(401).json({ error: 'Unauthorized' });

    const eventId = req.body['eventId'] as string;
    if (!eventId) return void res.status(400).json({ error: 'eventId required' });

    const files = req.files as Express.Multer.File[];
    if (!files?.length) return void res.status(400).json({ error: 'No files uploaded' });

    const results: Array<{ fileName: string; fileUrl: string }> = [];

    for (const file of files) {
      const path = `permits/${eventId}/${Date.now()}_${file.originalname}`;
      const { error: uploadError } = await supabase.storage
        .from('venview-permits')
        .upload(path, file.buffer, { contentType: file.mimetype });

      if (uploadError) {
        console.warn('Storage upload failed:', uploadError.message);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from('venview-permits').getPublicUrl(path);

      await supabase.from('Permits').insert({
        eventID: eventId,
        fileName: file.originalname,
        fileUrl: publicUrl,
        uploadedAt: new Date().toISOString(),
      });

      results.push({ fileName: file.originalname, fileUrl: publicUrl });
    }

    res.json({ success: true, files: results });
  } catch (err) {
    console.error('Permit upload error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export default router;
