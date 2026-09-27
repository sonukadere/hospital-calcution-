const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');

async function importRates() {
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

  function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  let ctAdded = 0;
  let xrayAdded = 0;

  // 1. Import CT Charges List-2025.xlsx
  const ctPath = path.resolve(__dirname, '../../../sample_data/CT Charges List-2025.xlsx');
  console.log('Reading CT charges from:', ctPath);
  const ctWb = xlsx.readFile(ctPath);
  const ctSheet = ctWb.Sheets['CT test rate list'];
  const ctRows = xlsx.utils.sheet_to_json(ctSheet, { header: 1 });

  for (let i = 4; i < ctRows.length; i++) {
    const r = ctRows[i];
    if (!r || !r[1]) continue;
    let rawName = String(r[1]).trim();
    if (rawName.includes('\n') || rawName.includes('\r')) {
      rawName = rawName.split(/[\r\n]+/)[0].replace(/\s+/g, ' ').trim();
    }
    const name = rawName;
    if (!name) continue;
    const rate = Number(r[5]) || Number(r[2]) || 0;

    await MasterRate.findOneAndUpdate(
      { serviceName: { $regex: '^' + escapeRegex(name) + '$', $options: 'i' } },
      {
        $set: {
          serviceName: name,
          masterRate: rate,
          vedaSharePercent: 20,
          sodaniSharePercent: 80
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    ctAdded++;

    // If Veda Test Name exists and is different, also add/upsert
    if (r[4]) {
      const vedaName = String(r[4]).trim();
      if (vedaName && vedaName.toLowerCase() !== name.toLowerCase()) {
        await MasterRate.findOneAndUpdate(
          { serviceName: { $regex: '^' + escapeRegex(vedaName) + '$', $options: 'i' } },
          {
            $set: {
              serviceName: vedaName,
              masterRate: rate,
              vedaSharePercent: 20,
              sodaniSharePercent: 80
            }
          },
          { upsert: true, returnDocument: 'after' }
        );
        ctAdded++;
      }
    }
  }

  // 2. Import X-Ray Charges 07.02.2024.xlsx
  const xrayPath = path.resolve(__dirname, '../../../sample_data/X-Ray Charges 07.02.2024.xlsx');
  console.log('Reading X-Ray charges from:', xrayPath);
  const xrayWb = xlsx.readFile(xrayPath);
  const xraySheet = xrayWb.Sheets['Sheet1'];
  const xrayRows = xlsx.utils.sheet_to_json(xraySheet, { header: 1 });

  for (let i = 1; i < xrayRows.length; i++) {
    const r = xrayRows[i];
    if (!r || !r[1]) continue;
    const name = String(r[1]).trim();
    if (!name) continue;
    const rate = Number(r[3]) || 0;

    await MasterRate.findOneAndUpdate(
      { serviceName: { $regex: '^' + escapeRegex(name) + '$', $options: 'i' } },
      {
        $set: {
          serviceName: name,
          masterRate: rate,
          vedaSharePercent: 30,
          sodaniSharePercent: 70
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    xrayAdded++;
  }

  const total = await MasterRate.countDocuments();
  console.log('✅ Import Completed:');
  console.log('   - CT entries upserted:', ctAdded);
  console.log('   - X-Ray entries upserted:', xrayAdded);
  console.log('   - Total Master Rates in DB:', total);

  await mongoose.disconnect();
}

importRates().catch((err) => {
  console.error('Import error:', err);
  process.exit(1);
});
