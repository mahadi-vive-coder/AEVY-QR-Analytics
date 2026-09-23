import { Router, Request, Response } from 'express';
import { JsonDatabase } from '../services/jsonDatabase.js';
import { requireAuth } from '../middleware.js';

export const visitorRouter = Router();
const db = JsonDatabase.getInstance();

// List all voluntary leads
visitorRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await db.getVisitors();
    const qrCodes = await db.getQRCodes();
    const campaigns = await db.getCampaigns();

    const qrMap = new Map(qrCodes.map((q) => [q.id.toLowerCase(), q.name]));
    const campMap = new Map(campaigns.map((c) => [c.id, c.name]));

    const { qr_id, campaign_id, search } = req.query;

    let filtered = list.map((item) => ({
      ...item,
      qr_name: qrMap.get(item.qr_id.toLowerCase()) || item.qr_id,
      campaign_name: campMap.get(item.campaign_id || '') || item.campaign_id || 'Direct',
    }));

    if (qr_id) {
      filtered = filtered.filter((v) => v.qr_id.toLowerCase() === String(qr_id).toLowerCase());
    }
    if (campaign_id) {
      filtered = filtered.filter((v) => v.campaign_id === campaign_id);
    }
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.email.toLowerCase().includes(q) ||
          v.phone.includes(q) ||
          v.qr_name.toLowerCase().includes(q)
      );
    }

    res.json({ visitors: filtered, total: filtered.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a voluntary lead
visitorRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const list = await db.getVisitors();
    const filtered = list.filter((v) => v.lead_id !== id);

    if (filtered.length === list.length) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    await (db as any).writeAtomic('visitors.json', filtered);
    res.json({ success: true, message: 'Lead record removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
