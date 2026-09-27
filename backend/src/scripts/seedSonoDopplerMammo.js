const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');

async function importSonoDopplerMammo() {
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

  function cleanName(raw) {
    if (!raw) return '';
    let name = String(raw).trim();
    if (name.includes('\n') || name.includes('\r')) {
      name = name.split(/[\r\n]+/)[0].replace(/\s+/g, ' ').trim();
    }
    return name;
  }

  // Master Rate Share rule: Sono / Doppler / Mammography = Veda 20% / Sodani 80%.
  // Rows in this list whose name is an X-Ray study keep the X-Ray rule
  // (Veda 30% / Sodani 70%), matching the category badge order in MasterRatePage.
  function shareFor(name) {
    if (/X-?RAY/i.test(name)) {
      return { vedaSharePercent: 30, sodaniSharePercent: 70 };
    }
    return { vedaSharePercent: 20, sodaniSharePercent: 80 };
  }

  const filePath = path.resolve(__dirname, '../../../sample_data/Sono, Color Doppler, Mammography Charges 07.02.2024.xlsx');
  console.log('Reading file:', filePath);
  const wb = xlsx.readFile(filePath);

  const sheet = wb.Sheets['Sheet1'];
  if (!sheet) {
    console.error('Sheet1 not found');
    process.exit(1);
  }

  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  let importedCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[1]) continue;
    const name = cleanName(r[1]);
    if (!name) continue;
    const rate = Number(r[3]) || 0;

    await MasterRate.findOneAndUpdate(
      { serviceName: { $regex: '^' + escapeRegex(name) + '$', $options: 'i' } },
      {
        $set: {
          serviceName: name,
          masterRate: rate,
          ...shareFor(name)
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
    importedCount++;
  }

  const total = await MasterRate.countDocuments();
  console.log('✅ Sono, Color Doppler, Mammography Import Completed:');
  console.log('   - Tests imported/updated:', importedCount);
  console.log('   - Total Master Rates in DB now:', total);

  await mongoose.disconnect();
}

importSonoDopplerMammo().catch((err) => {
  console.error('Import error:', err);
  process.exit(1);
});
