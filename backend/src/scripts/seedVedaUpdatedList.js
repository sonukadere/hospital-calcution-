const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');

async function importVedaUpdatedList() {
  await mongoose.connect('mongodb://127.0.0.1:27017/pathology_billing');
  console.log('Connected to MongoDB: pathology_billing');

  const MasterRateSchema = new mongoose.Schema(
    {
      serviceName: { type: String, required: true, unique: true, trim: true },
      masterRate: { type: Number, required: true, default: 0 },
      vedaSharePercent: { type: Number, default: 0 },
      sodaniSharePercent: { type: Number, default: 100 }
    },
    { timestamps: true, collection: 'master_rates' }
  );

  const MasterRate = mongoose.models.MasterRate || mongoose.model('MasterRate', MasterRateSchema);

  const BillingRecordSchema = new mongoose.Schema({}, { strict: false, collection: 'billing_share_records' });
  const BillingShareRecord = mongoose.models.BillingShareRecord || mongoose.model('BillingShareRecord', BillingRecordSchema);

  function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  function cleanName(raw) {
    if (!raw) return '';
    let name = String(raw).trim();
    if (name.includes('\n') || name.includes('\r')) {
      name = name.split(/[\r\n]+/)[0].replace(/\s+/g, ' ').trim();
    }
    return name;
  }

  const filePath = path.resolve(__dirname, '../../../sample_data/Veda Hospital_Pathology Ujjain, _ updated List.xlsx');
  console.log('Reading file:', filePath);
  const wb = xlsx.readFile(filePath);

  let updatedCount = 0;
  let profileCount = 0;

  // 1. Process updated pathology test list
  console.log('Processing sheet: updated pathology test list with Veda Share %...');
  const s1 = wb.Sheets['updated pathology test list'];
  if (s1) {
    const rows = xlsx.utils.sheet_to_json(s1, { header: 1 });
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[1]) continue;
      const name = cleanName(r[1]);
      if (!name) continue;
      const rate = Number(r[3]) || 0;

      let vedaPct = 52;
      if (r[6] !== undefined && r[6] !== null && r[6] !== '') {
        const val = Number(r[6]);
        if (!isNaN(val)) {
          vedaPct = val <= 1 ? Math.round(val * 100) : Math.round(val);
        }
      }
      const sodaniPct = Math.max(0, 100 - vedaPct);

      await MasterRate.findOneAndUpdate(
        { serviceName: { $regex: '^' + escapeRegex(name) + '$', $options: 'i' } },
        {
          $set: {
            serviceName: name,
            masterRate: rate,
            vedaSharePercent: vedaPct,
            sodaniSharePercent: sodaniPct
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
      updatedCount++;
    }
  }

  // 2. Process Profile test
  console.log('Processing sheet: Profile test...');
  const s2 = wb.Sheets['Profile test'];
  if (s2) {
    const rows = xlsx.utils.sheet_to_json(s2, { header: 1 });
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;

      const vedaPct = 52;
      const sodaniPct = 48;

      // Profile test name
      if (r[1] && r[4]) {
        const pName = cleanName(r[1]);
        const pRate = Number(r[4]) || 0;
        if (pName && pRate > 0) {
          await MasterRate.findOneAndUpdate(
            { serviceName: { $regex: '^' + escapeRegex(pName) + '$', $options: 'i' } },
            {
              $set: {
                serviceName: pName,
                masterRate: pRate,
                vedaSharePercent: vedaPct,
                sodaniSharePercent: sodaniPct
              }
            },
            { upsert: true, returnDocument: 'after' }
          );
          profileCount++;
        }
      }

      // Individual test
      if (r[3]) {
        const tName = cleanName(r[3]);
        const tRate = Number(r[5]) || Number(r[4]) || 0;
        if (tName && tRate > 0) {
          await MasterRate.findOneAndUpdate(
            { serviceName: { $regex: '^' + escapeRegex(tName) + '$', $options: 'i' } },
            {
              $set: {
                serviceName: tName,
                masterRate: tRate,
                vedaSharePercent: vedaPct,
                sodaniSharePercent: sodaniPct
              }
            },
            { upsert: true, returnDocument: 'after' }
          );
          profileCount++;
        }
      }
    }
  }

  const total = await MasterRate.countDocuments();
  console.log('✅ Veda Updated List Import Completed:');
  console.log('   - Updated tests with Veda share %:', updatedCount);
  console.log('   - Profile tests processed:', profileCount);
  console.log('   - Total Master Rates in DB now:', total);

  // Recalculate Billing Records
  console.log('Recalculating all billing records against updated Master Rates...');
  const allMasterRates = await MasterRate.find({});
  const rateMap = new Map();
  allMasterRates.forEach(mr => {
    rateMap.set(mr.serviceName.trim().toLowerCase().replace(/\s+/g, ' '), {
      masterRate: mr.masterRate,
      vedaPct: mr.vedaSharePercent,
      sodaniPct: mr.sodaniSharePercent
    });
  });

  const billingRecords = await BillingShareRecord.find({});
  let matched = 0;
  let unmatched = 0;

  const bulkOps = billingRecords.map(rec => {
    const key = String(rec.serviceName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const m = rateMap.get(key);
    if (m) {
      matched++;
      const qty = rec.qty || 1;
      const masterAmount = Math.round(m.masterRate * qty * 100) / 100;
      const vedaShare = Math.round(((masterAmount * m.vedaPct) / 100) * 100) / 100;
      const sodaniShare = Math.round(((masterAmount * m.sodaniPct) / 100) * 100) / 100;
      return {
        updateOne: {
          filter: { _id: rec._id },
          update: {
            $set: {
              masterRate: m.masterRate,
              masterAmount,
              vedaSharePercent: m.vedaPct,
              sodaniSharePercent: m.sodaniPct,
              vedaShare,
              sodaniShare,
              isMatched: true
            }
          }
        }
      };
    } else {
      unmatched++;
      return {
        updateOne: {
          filter: { _id: rec._id },
          update: {
            $set: {
              masterRate: 0,
              masterAmount: 0,
              vedaSharePercent: 0,
              sodaniSharePercent: 0,
              vedaShare: 0,
              sodaniShare: 0,
              isMatched: false
            }
          }
        }
      };
    }
  });

  if (bulkOps.length > 0) {
    await BillingShareRecord.bulkWrite(bulkOps);
  }

  console.log(`✅ Recalculated ${billingRecords.length} records: ${matched} matched, ${unmatched} unmatched.`);

  await mongoose.disconnect();
}

importVedaUpdatedList().catch((err) => {
  console.error('Import error:', err);
  process.exit(1);
});
