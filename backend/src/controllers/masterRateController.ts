import { Request, Response } from 'express';
import { MasterRate, BillingShareRecord } from '../models';

export const getMasterRates = async (req: Request, res: Response) => {
  try {
    const { search, category, page, limit } = req.query;
    const query: any = {};

    if (search && typeof search === 'string') {
      query.serviceName = { $regex: search.trim(), $options: 'i' };
    }

    if (category === 'CT') {
      const ctRegex = { $regex: '(^|\\s|/)CT(\\s|/|$)', $options: 'i' };
      query.serviceName = query.serviceName ? { $all: [query.serviceName, ctRegex] } : ctRegex;
    } else if (category === 'XRAY') {
      const xrayRegex = { $regex: 'X-?RAY', $options: 'i' };
      query.serviceName = query.serviceName ? { $all: [query.serviceName, xrayRegex] } : xrayRegex;
    } else if (category === 'SONO') {
      const sonoRegex = { $regex: '(SONO|DOPPLER|MAMMO|USG|^CD\\s)', $options: 'i' };
      query.serviceName = query.serviceName ? { $all: [query.serviceName, sonoRegex] } : sonoRegex;
    } else if (category === 'PATHOLOGY') {
      const pathRegex = { $not: { $regex: '((^|\\s|/)CT(\\s|/|$)|X-?RAY|SONO|DOPPLER|MAMMO|USG|^CD\\s)', $options: 'i' } };
      if (query.serviceName) {
        query.$and = [{ serviceName: query.serviceName }, { serviceName: pathRegex }];
        delete query.serviceName;
      } else {
        query.serviceName = pathRegex;
      }
    }

    const sortField = (req.query.sortBy as string) || 'serviceName';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

    // Get modality category counts
    const [allCount, ctCount, xrayCount, sonoCount] = await Promise.all([
      MasterRate.countDocuments({}),
      MasterRate.countDocuments({ serviceName: { $regex: '(^|\\s|/)CT(\\s|/|$)', $options: 'i' } }),
      MasterRate.countDocuments({ serviceName: { $regex: 'X-?RAY', $options: 'i' } }),
      MasterRate.countDocuments({ serviceName: { $regex: '(SONO|DOPPLER|MAMMO|USG|^CD\\s)', $options: 'i' } }),
    ]);

    const counts = {
      all: allCount,
      ct: ctCount,
      xray: xrayCount,
      sono: sonoCount,
      pathology: Math.max(0, allCount - ctCount - xrayCount - sonoCount),
    };

    if (page && limit) {
      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 50;
      const skip = (pageNum - 1) * limitNum;

      const [rates, total] = await Promise.all([
        MasterRate.find(query).sort({ [sortField]: sortOrder }).skip(skip).limit(limitNum),
        MasterRate.countDocuments(query),
      ]);

      return res.json({
        rates,
        counts,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    const rates = await MasterRate.find(query).sort({ [sortField]: sortOrder });
    return res.json({ rates, counts, total: rates.length });
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
    const existing = await MasterRate.findOne({
      serviceName: { $regex: `^${trimmedName}$`, $options: 'i' },
    });

    if (existing) {
      return res.status(409).json({ error: `Service '${trimmedName}' already exists` });
    }

    const rateNum = Number(masterRate) || 0;
    const vedaPct = Math.min(100, Math.max(0, Number(vedaSharePercent) || 0));
    const sodaniPct = Math.max(0, 100 - vedaPct);

    const newRate = await MasterRate.create({
      serviceName: trimmedName,
      masterRate: rateNum,
      vedaSharePercent: vedaPct,
      sodaniSharePercent: sodaniPct,
    });

    // Optionally update any existing billing records for this service
    await updateBillingRecordsForService(trimmedName, rateNum, vedaPct, sodaniPct);

    return res.status(201).json(newRate);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create master rate' });
  }
};

export const updateMasterRate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { serviceName, masterRate, vedaSharePercent } = req.body;

    const rateNum = Number(masterRate) || 0;
    const vedaPct = Math.min(100, Math.max(0, Number(vedaSharePercent) || 0));
    const sodaniPct = Math.max(0, 100 - vedaPct);
    const trimmedName = serviceName ? serviceName.trim() : undefined;

    const updated = await MasterRate.findByIdAndUpdate(
      id,
      {
        ...(trimmedName ? { serviceName: trimmedName } : {}),
        masterRate: rateNum,
        vedaSharePercent: vedaPct,
        sodaniSharePercent: sodaniPct,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Master rate not found' });
    }

    // Recalculate billing records for this service
    await updateBillingRecordsForService(updated.serviceName, rateNum, vedaPct, sodaniPct);

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update master rate' });
  }
};

export const deleteMasterRate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rate = await MasterRate.findByIdAndDelete(id);
    if (!rate) {
      return res.status(404).json({ error: 'Master rate not found' });
    }

    // Flag related billing records as unmatched
    await BillingShareRecord.updateMany(
      { serviceName: { $regex: `^${rate.serviceName}$`, $options: 'i' } },
      {
        $set: {
          masterRate: 0,
          masterAmount: 0,
          vedaSharePercent: 0,
          sodaniSharePercent: 0,
          vedaShare: 0,
          sodaniShare: 0,
          isMatched: false,
        },
      }
    );

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

      const existing = await MasterRate.findOne({
        serviceName: { $regex: `^${trimmed}$`, $options: 'i' },
      });

      if (existing) {
        existing.masterRate = rateNum;
        existing.vedaSharePercent = vedaPct;
        existing.sodaniSharePercent = sodaniPct;
        await existing.save();
        updated++;
      } else {
        await MasterRate.create({
          serviceName: trimmed,
          masterRate: rateNum,
          vedaSharePercent: vedaPct,
          sodaniSharePercent: sodaniPct,
        });
        inserted++;
      }

      await updateBillingRecordsForService(trimmed, rateNum, vedaPct, sodaniPct);
    }

    return res.json({ message: 'Bulk upsert completed', inserted, updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to bulk upsert master rates' });
  }
};

export const clearAllMasterRates = async (_req: Request, res: Response) => {
  try {
    await MasterRate.deleteMany({});
    // Reset all billing records to unmatched
    await BillingShareRecord.updateMany(
      {},
      {
        $set: {
          masterRate: 0,
          masterAmount: 0,
          vedaSharePercent: 0,
          sodaniSharePercent: 0,
          percent: '-',
          vedaShare: 0,
          sodaniShare: 0,
          isMatched: false,
        },
      }
    );
    return res.json({ message: 'All master rates cleared' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to clear master rates' });
  }
};

// Helper: update matching billing records and compute shares
async function updateBillingRecordsForService(
  serviceName: string,
  masterRate: number,
  vedaPct: number,
  sodaniPct: number
) {
  const records = await BillingShareRecord.find({
    serviceName: { $regex: `^${serviceName}$`, $options: 'i' },
  });

  const percentStr = `Veda: ${vedaPct}% | Sodani: ${sodaniPct}%`;

  const bulkOps = records.map((rec) => {
    const qty = rec.qty || 1;
    const masterAmount = Math.round(masterRate * qty * 100) / 100;
    const vedaShare = Math.round(((masterAmount * vedaPct) / 100) * 100) / 100;
    const sodaniShare = Math.round(((masterAmount * sodaniPct) / 100) * 100) / 100;

    return {
      updateOne: {
        filter: { _id: rec._id },
        update: {
          $set: {
            masterRate,
            masterAmount,
            vedaSharePercent: vedaPct,
            sodaniSharePercent: sodaniPct,
            percent: percentStr,
            vedaShare,
            sodaniShare,
            isMatched: true,
          },
        },
      },
    };
  });

  if (bulkOps.length > 0) {
    await BillingShareRecord.bulkWrite(bulkOps);
  }
}
