const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');

async function importPathology() {
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

  // Master Rate Share rules. X-Ray services = Veda 30% / Sodani 70%.
  // Every other service keeps its existing 0% Veda / 100% Sodani share.
  function shareFor(name) {
    if (/X-?RAY/i.test(name)) {
      return { vedaSharePercent: 30, sodaniSharePercent: 70 };
    }
    return { vedaSharePercent: 0, sodaniSharePercent: 100 };
  }

  const filePath = path.resolve(__dirname, '../../../sample_data/Pathology  07.02.2024.xlsx');
  console.log('Reading file:', filePath);
  const wb = xlsx.readFile(filePath);

  let sheet1Count = 0;
  let profileCount = 0;
  let updatedCount = 0;

  // 1. Process Patho_XRay_TMT
  console.log('Processing sheet: Patho_XRay_TMT...');
  const s1 = wb.Sheets['Patho_XRay_TMT'];
  if (s1) {
    const rows = xlsx.utils.sheet_to_json(s1, { header: 1 });
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
      sheet1Count++;
    }
  }

  // 2. Process Profile test
  console.log('Processing sheet: Profile test...');
  const s3 = wb.Sheets['Profile test'];
  if (s3) {
    const rows = xlsx.utils.sheet_to_json(s3, { header: 1 });
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;

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
                ...shareFor(pName)
              }
            },
            { upsert: true, returnDocument: 'after' }
          );
          profileCount++;
        }
      }

      // Individual test item
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
                ...shareFor(tName)
              }
            },
            { upsert: true, returnDocument: 'after' }
          );
          profileCount++;
        }
      }
    }
  }

  // 3. Process updated pathology test list (has newest 2024 rates)
  console.log('Processing sheet: updated pathology test list...');
  const s2 = wb.Sheets['updated pathology test list'];
  if (s2) {
    const rows = xlsx.utils.sheet_to_json(s2, { header: 1 });
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
      updatedCount++;
    }
  }

  const total = await MasterRate.countDocuments();
  console.log('✅ Pathology Test List Import Completed:');
  console.log('   - Patho_XRay_TMT entries:', sheet1Count);
  console.log('   - Profile test entries:', profileCount);
  console.log('   - Updated test list entries:', updatedCount);
  console.log('   - Total Master Rates in DB now:', total);

  await mongoose.disconnect();
}

importPathology().catch((err) => {
  console.error('Import error:', err);
  process.exit(1);
});
