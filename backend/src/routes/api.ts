import { Router } from 'express';
import multer from 'multer';
import {
  getMasterRates,
  createMasterRate,
  updateMasterRate,
  deleteMasterRate,
  bulkUpsertMasterRates,
  clearAllMasterRates,
} from '../controllers/masterRateController';
import {
  previewMasterRateExcel,
  importMasterRateExcel,
  downloadMasterRateTemplate,
} from '../controllers/masterRateExcelController';
import {
  uploadAndProcessExcel,
  getBillingRecords,
  recalculateAllBilling,
  exportBillingExcel,
  clearBillingRecords,
  deleteMonthRecords,
  getUnmatchedServices,
} from '../controllers/shareBillingController';
import { processShareManagementExcel } from '../controllers/shareManagementProcessController';
import { store } from '../store/inMemoryStore';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Health check
router.get('/health', async (_req, res) => {
  try {
    const rateCount = store.countMasterRates();
    const recordCount = store.countBillingRecords();
    res.json({
      status: 'ok',
      service: 'Pathology Share Management API',
      database: 'IN-MEMORY (No DB Required)',
      stats: {
        masterRates: rateCount,
        billingRecords: recordCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Master Rate Routes
router.get('/master-rates', getMasterRates);
router.post('/master-rates', createMasterRate);
router.post('/master-rates/bulk', bulkUpsertMasterRates);
router.put('/master-rates/:id', updateMasterRate);
router.delete('/master-rates/:id', deleteMasterRate);
router.delete('/master-rates', clearAllMasterRates);

// Master Rate Excel Import (preview -> confirm -> save)
router.post('/master-rates/import/preview', upload.single('file'), previewMasterRateExcel);
router.post('/master-rates/import/commit', upload.single('file'), importMasterRateExcel);
router.get('/master-rates/import/template', downloadMasterRateTemplate);

// Share Management / Billing Routes
router.post('/billing/upload', upload.single('file'), uploadAndProcessExcel);
router.get('/billing/records', getBillingRecords);
router.post('/billing/recalculate', recalculateAllBilling);
router.get('/billing/export', exportBillingExcel);
router.delete('/billing/clear', clearBillingRecords);
router.delete('/billing/month/:monthKey', deleteMonthRecords);
router.get('/billing/unmatched', getUnmatchedServices);

// Dedicated Share Management Excel Processing (In-Memory match & export workflow)
router.post('/share-management/process', upload.single('file'), processShareManagementExcel);

export default router;
