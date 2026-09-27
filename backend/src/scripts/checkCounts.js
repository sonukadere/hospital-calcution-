const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/pathology_billing');
  const MasterRate = mongoose.model('MasterRate', new mongoose.Schema({ serviceName: String }, { collection: 'master_rates' }));
  const total = await MasterRate.countDocuments();
  const ct = await MasterRate.countDocuments({ serviceName: { $regex: '(^|\\s|/)CT(\\s|/|$)', $options: 'i' } });
  const xray = await MasterRate.countDocuments({ serviceName: { $regex: 'X-?RAY', $options: 'i' } });
  const sono = await MasterRate.countDocuments({ serviceName: { $regex: '(SONO|DOPPLER|MAMMO|USG|^CD\\s)', $options: 'i' } });
  console.log('Category Counts:', { total, ct, xray, sono, pathology: Math.max(0, total - ct - xray - sono) });
  await mongoose.disconnect();
}

test();
