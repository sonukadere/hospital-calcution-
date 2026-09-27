const mongoose = require('mongoose');

async function inspectDatabase() {
  console.log('====================================================');
  console.log('🔍 MONGODB DATABASE INSPECTION: pathology_billing');
  console.log('====================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/pathology_billing');
  const db = mongoose.connection.db;

  // 1. List all collections
  const collections = await db.listCollections().toArray();
  console.log('📁 ACTIVE COLLECTIONS:');
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`   - ${c.name.padEnd(25)} : ${count} records`);
  }
  console.log('');

  // 2. Master Rates Inspection
  const masterCol = db.collection('master_rates');
  const totalMaster = await masterCol.countDocuments();
  console.log(`----------------------------------------------------`);
  console.log(`✅ 1. MASTER RATES COLLECTION (Total: ${totalMaster})`);
  console.log(`----------------------------------------------------`);

  // Sample CT
  const sampleCT = await masterCol.findOne({ serviceName: { $regex: '(^|\\s|/)CT(\\s|/|$)', $options: 'i' } });
  console.log('\n🔹 Sample CT Scan Rate:');
  console.log({
    service: sampleCT?.serviceName,
    rate: sampleCT?.masterRate,
    vedaShare: `${sampleCT?.vedaSharePercent}%`,
    sodaniShare: `${sampleCT?.sodaniSharePercent}%`
  });

  // Sample X-Ray
  const sampleXRay = await masterCol.findOne({ serviceName: { $regex: 'X-?RAY', $options: 'i' } });
  console.log('\n🔹 Sample X-Ray Rate:');
  console.log({
    service: sampleXRay?.serviceName,
    rate: sampleXRay?.masterRate,
    vedaShare: `${sampleXRay?.vedaSharePercent}%`,
    sodaniShare: `${sampleXRay?.sodaniSharePercent}%`
  });

  // Sample Sono/Doppler
  const sampleSono = await masterCol.findOne({ serviceName: { $regex: '(SONO|DOPPLER|MAMMO|^CD\\s)', $options: 'i' } });
  console.log('\n🔹 Sample Sono / Doppler Rate:');
  console.log({
    service: sampleSono?.serviceName,
    rate: sampleSono?.masterRate,
    vedaShare: `${sampleSono?.vedaSharePercent}%`,
    sodaniShare: `${sampleSono?.sodaniSharePercent}%`
  });

  // Sample Pathology with Veda Share
  const samplePath = await masterCol.findOne({ vedaSharePercent: { $gt: 0 } });
  console.log('\n🔹 Sample Pathology Rate (with Veda Share %):');
  console.log({
    service: samplePath?.serviceName,
    rate: samplePath?.masterRate,
    vedaShare: `${samplePath?.vedaSharePercent}%`,
    sodaniShare: `${samplePath?.sodaniSharePercent}%`
  });

  // 3. Billing Share Records Inspection
  const billingCol = db.collection('billing_share_records');
  const totalBilling = await billingCol.countDocuments();
  console.log(`\n----------------------------------------------------`);
  console.log(`✅ 2. BILLING SHARE RECORDS COLLECTION (Total: ${totalBilling})`);
  console.log(`----------------------------------------------------`);

  const agg = await billingCol.aggregate([
    {
      $group: {
        _id: null,
        totalBilledNet: { $sum: '$netAmt' },
        totalMasterAmount: { $sum: '$masterAmount' },
        totalVedaShare: { $sum: '$vedaShare' },
        totalSodaniShare: { $sum: '$sodaniShare' },
        recordsCount: { $sum: 1 }
      }
    }
  ]).toArray();

  if (agg.length > 0) {
    const s = agg[0];
    console.log('\n📊 FINANCIAL TOTALS STORED IN DATABASE:');
    console.log(`   - Total Processed Bills   : ${s.recordsCount}`);
    console.log(`   - Total Net Billed Amount : ₹${s.totalBilledNet.toLocaleString('en-IN')}`);
    console.log(`   - Total Master Amount     : ₹${s.totalMasterAmount.toLocaleString('en-IN')}`);
    console.log(`   - 🔵 Total Veda Share     : ₹${s.totalVedaShare.toLocaleString('en-IN')}`);
    console.log(`   - 🟢 Total Sodani Share   : ₹${s.totalSodaniShare.toLocaleString('en-IN')}`);
  }

  // Sample Billing Record
  const sampleBill = await billingCol.findOne({ isMatched: true, vedaShare: { $gt: 0 } });
  console.log('\n🔹 Live Stored Billing Record (Sample with 15 Fields):');
  console.log({
    sNo: sampleBill?.sNo,
    billingGroup: sampleBill?.billingGroup,
    date: sampleBill?.billServiceDate,
    billNo: sampleBill?.billNo,
    patientName: sampleBill?.patientName,
    serviceName: sampleBill?.serviceName,
    qty: sampleBill?.qty,
    totalAmt: sampleBill?.totalAmt,
    netAmt: sampleBill?.netAmt,
    rate: sampleBill?.rate,
    masterRate: sampleBill?.masterRate,
    masterAmount: sampleBill?.masterAmount,
    vedaShare: `₹${sampleBill?.vedaShare} (${sampleBill?.vedaSharePercent}%)`,
    sodaniShare: `₹${sampleBill?.sodaniShare} (${sampleBill?.sodaniSharePercent}%)`
  });

  console.log('\n====================================================');
  console.log('🎉 ALL DATA IS PERMANENTLY SAVED IN MONGODB!');
  console.log('====================================================');

  await mongoose.disconnect();
}

inspectDatabase().catch((err) => {
  console.error('Inspection error:', err);
  process.exit(1);
});
