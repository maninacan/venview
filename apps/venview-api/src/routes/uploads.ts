import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabase.js';
import { createContext } from '../context/index.js';

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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
