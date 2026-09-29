import { Request, Response } from 'express';
import { store } from '../store/inMemoryStore';

export const getMasterRates = async (req: Request, res: Response) => {
  try {
    const { search, category, page, limit, sortBy, sortOrder } = req.query;

    const result = store.findMasterRates({
      search: search as string,
      category: category as string,
      sortBy: (sortBy as string) || 'serviceName',
      sortOrder: (sortOrder as 'asc' | 'desc') || 'asc',
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    if (result.pagination) {
      return res.json({
        rates: result.rates,
        counts: result.counts,
        pagination: result.pagination,
      });
    }

    return res.json({ rates: result.rates, counts: result.counts, total: result.total });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch master rates' });
  }
};

export const createMasterRate = async (req: Request, res: Response) => {
  try {
    const { serviceName, masterRate, vedaSharePercent } = req.body;

    if (!serviceName || typeof serviceName !== 'string') {
      return res.status(400).json({ error: 'Service Name is required' });
    }

    const trimmedName = serviceName.trim();
    const existing = store.findMasterRateByName(trimmedName);

    if (existing) {
      return res.status(409).json({ error: `Service '${trimmedName}' already exists` });
    }

    const rateNum = Number(masterRate) || 0;
    const vedaPct = Math.min(100, Math.max(0, Number(vedaSharePercent) || 0));
    const sodaniPct = Math.max(0, 100 - vedaPct);

    const newRate = store.createMasterRate({
      serviceName: trimmedName,
      masterRate: rateNum,
      vedaSharePercent: vedaPct,
      sodaniSharePercent: sodaniPct,
    });

    // Update any existing billing records for this service
    store.updateBillingRecordsForService(trimmedName, rateNum, vedaPct, sodaniPct);

    return res.status(201).json(newRate);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create master rate' });
  }
};

export const updateMasterRate = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { serviceName, masterRate, vedaSharePercent } = req.body;

    const rateNum = Number(masterRate) || 0;
    const vedaPct = Math.min(100, Math.max(0, Number(vedaSharePercent) || 0));
    const sodaniPct = Math.max(0, 100 - vedaPct);
    const trimmedName = serviceName ? serviceName.trim() : undefined;

    const updated = store.updateMasterRate(id, {
      ...(trimmedName ? { serviceName: trimmedName } : {}),
      masterRate: rateNum,
      vedaSharePercent: vedaPct,
      sodaniSharePercent: sodaniPct,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Master rate not found' });
    }

    // Recalculate billing records for this service
    store.updateBillingRecordsForService(updated.serviceName, rateNum, vedaPct, sodaniPct);

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update master rate' });
  }
};

export const deleteMasterRate = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const rate = store.deleteMasterRate(id);
    if (!rate) {
      return res.status(404).json({ error: 'Master rate not found' });
    }

    // Flag related billing records as unmatched
    store.resetBillingForService(rate.serviceName);

    return res.json({ message: 'Master rate deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete master rate' });
  }
};

export const bulkUpsertMasterRates = async (req: Request, res: Response) => {
  try {
    const { rates } = req.body;
    if (!Array.isArray(rates) || rates.length === 0) {
      return res.status(400).json({ error: 'Rates array is required' });
    }

    let inserted = 0;
    let updated = 0;

    for (const item of rates) {
      if (!item.serviceName) continue;
      const trimmed = String(item.serviceName).trim();
      const rateNum = Number(item.masterRate) || 0;
      const vedaPct = Math.min(100, Math.max(0, Number(item.vedaSharePercent) || 0));
      const sodaniPct = Math.max(0, 100 - vedaPct);

      const existing = store.findMasterRateByName(trimmed);

      if (existing) {
        store.updateMasterRate(existing._id, {
          masterRate: rateNum,
          vedaSharePercent: vedaPct,
          sodaniSharePercent: sodaniPct,
        });
        updated++;
      } else {
        store.createMasterRate({
          serviceName: trimmed,
          masterRate: rateNum,
          vedaSharePercent: vedaPct,
          sodaniSharePercent: sodaniPct,
        });
        inserted++;
      }

      store.updateBillingRecordsForService(trimmed, rateNum, vedaPct, sodaniPct);
    }

    return res.json({ message: 'Bulk upsert completed', inserted, updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to bulk upsert master rates' });
  }
};

export const clearAllMasterRates = async (_req: Request, res: Response) => {
  try {
    store.clearAllMasterRates();
    // Reset all billing records to unmatched
    store.resetAllBillingShares();
    return res.json({ message: 'All master rates cleared' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to clear master rates' });
  }
};
