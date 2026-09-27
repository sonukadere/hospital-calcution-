import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { round2, safePercent, safeSub, safeAdd } from '../src/utils/precision';
import { seedServices } from '../src/scripts/seedServicesFromRateList';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clean existing records if any
  await prisma.adjustment.deleteMany({});
  await prisma.settlementItem.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.billingRecord.deleteMany({});
  await prisma.visit.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.pathologyService.deleteMany({});
  await prisma.billingGroup.deleteMany({});
  await prisma.shareConfiguration.deleteMany({});
  await prisma.importError.deleteMany({});
  await prisma.importLog.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Seed Users
  const passwordHash = await bcrypt.hash('admin123', 10);
  const operatorPasswordHash = await bcrypt.hash('operator123', 10);
  const accountPasswordHash = await bcrypt.hash('account123', 10);

  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'superadmin@pathology.com',
      password: passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    }
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Dr. Rajesh Sharma',
      email: 'admin@pathology.com',
      password: passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  });

  const accountant = await prisma.user.create({
    data: {
      name: 'Pooja Verma (Accountant)',
      email: 'accountant@pathology.com',
      password: accountPasswordHash,
      role: 'ACCOUNTANT',
      status: 'ACTIVE'
    }
  });

  const operator = await prisma.user.create({
    data: {
      name: 'Sunil Kumar (Operator)',
      email: 'operator@pathology.com',
      password: operatorPasswordHash,
      role: 'OPERATOR',
      status: 'ACTIVE'
    }
  });

  console.log('✅ Users seeded: Super Admin, Admin, Accountant, Operator');

  // 3. Seed Billing Groups
  const billingGroupsData = [
    { name: 'AYUSHMAN BHARAT', code: 'AB-PMJAY', defaultDiscountPercent: 0 },
    { name: 'CGHS', code: 'CGHS', defaultDiscountPercent: 0 },
    { name: 'PRIVATE', code: 'PVT', defaultDiscountPercent: 0 },
    { name: 'CORPORATE', code: 'CORP', defaultDiscountPercent: 10 },
    { name: 'INSURANCE', code: 'INS', defaultDiscountPercent: 5 },
    { name: 'OTHER', code: 'OTH', defaultDiscountPercent: 0 }
  ];

  const createdGroups: Record<string, any> = {};
  for (const bg of billingGroupsData) {
    createdGroups[bg.name] = await prisma.billingGroup.create({ data: bg });
  }
  console.log('✅ Billing groups seeded');

  // 4. Seed Services
  const servicesData = [
    { serviceId: 'SRV-CREAT', name: 'Creatinine Serum', category: 'Biochemistry', testCode: 'CREAT', defaultRate: 220, shdplRate: 114.40, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-CBC', name: 'Complete Blood Count (CBC)', category: 'Hematology', testCode: 'CBC', defaultRate: 350, shdplRate: 182.00, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-LFT', name: 'Liver Function Test (LFT)', category: 'Biochemistry', testCode: 'LFT', defaultRate: 750, shdplRate: 390.00, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-KFT', name: 'Kidney Function Test (KFT)', category: 'Biochemistry', testCode: 'KFT', defaultRate: 700, shdplRate: 364.00, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-LIPID', name: 'Lipid Profile', category: 'Biochemistry', testCode: 'LIPID', defaultRate: 650, shdplRate: 338.00, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-TFT', name: 'Thyroid Profile (T3, T4, TSH)', category: 'Immunology', testCode: 'TFT', defaultRate: 550, shdplRate: 286.00, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-BS', name: 'Blood Sugar Fasting & PP', category: 'Biochemistry', testCode: 'BSFPP', defaultRate: 150, shdplRate: 78.00, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-URINE', name: 'Urine Routine & Microscopic', category: 'Clinical Pathology', testCode: 'URINE', defaultRate: 180, shdplRate: 93.60, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-HBA1C', name: 'HbA1c (Glycosylated Hemoglobin)', category: 'Biochemistry', testCode: 'HBA1C', defaultRate: 450, shdplRate: 234.00, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-VITD', name: 'Vitamin D (25-OH)', category: 'Immunology', testCode: 'VITD', defaultRate: 1200, shdplRate: 624.00, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-VITB12', name: 'Vitamin B12', category: 'Immunology', testCode: 'VITB12', defaultRate: 950, shdplRate: 494.00, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 },
    { serviceId: 'SRV-DENGUE', name: 'Dengue NS1 Antigen', category: 'Serology', testCode: 'DENGUE', defaultRate: 600, shdplRate: 312.00, vedaSharePercent: 20, sodaniSharePercent: 28, shdplPercent: 52 }
  ];

  const createdServices: Record<string, any> = {};
  for (const s of servicesData) {
    createdServices[s.name] = await prisma.pathologyService.create({ data: s });
  }
  console.log('✅ Base pathology services seeded');
  console.log('📂 Seeding master rate list from sample_data...');
  await seedServices();

  // 5. Seed Global Share Configurations (Effective from 2025-01-01 to infinity)
  const shareConfigsData = [
    { partnerName: 'SHDPL', percentage: 52.0, effectiveFrom: new Date('2025-01-01T00:00:00Z') },
    { partnerName: 'VEDA', percentage: 20.0, effectiveFrom: new Date('2025-01-01T00:00:00Z') },
    { partnerName: 'SODANI', percentage: 28.0, effectiveFrom: new Date('2025-01-01T00:00:00Z') }
  ];
  for (const sc of shareConfigsData) {
    await prisma.shareConfiguration.create({ data: { ...sc, status: 'ACTIVE' } });
  }
  console.log('✅ Global share configurations seeded (SHDPL: 52%, Veda: 20%, Sodani: 28%)');

  // 6. Seed Realistic Patients
  const patientsData = [
    { patientId: 'PAT-10021', name: 'Rameshwar Patidar', age: 48, gender: 'MALE', mobile: '9826011223', address: 'Scheme No. 54, Vijay Nagar, Indore', referringDoctor: 'Dr. V.K. Singhal', billingGroupId: 'AYUSHMAN BHARAT' },
    { patientId: 'PAT-10022', name: 'Sunita Mehra', age: 39, gender: 'FEMALE', mobile: '9893044556', address: 'Old Palasia, Indore', referringDoctor: 'Dr. Anita Joshi', billingGroupId: 'PRIVATE' },
    { patientId: 'PAT-10023', name: 'Kishanlal Sharma', age: 62, gender: 'MALE', mobile: '9425077889', address: 'Annapurna Road, Indore', referringDoctor: 'Dr. P.C. Jain', billingGroupId: 'CGHS' },
    { patientId: 'PAT-10024', name: 'Deepika Rathore', age: 29, gender: 'FEMALE', mobile: '9179012345', address: 'Bhawarkua, Indore', referringDoctor: 'Dr. Sneha Agrawal', billingGroupId: 'CORPORATE' },
    { patientId: 'PAT-10025', name: 'Anil Kumar Tiwari', age: 54, gender: 'MALE', mobile: '9827055667', address: 'Rau, Indore', referringDoctor: 'Dr. M.L. Gupta', billingGroupId: 'AYUSHMAN BHARAT' },
    { patientId: 'PAT-10026', name: 'Pooja Chouhan', age: 34, gender: 'FEMALE', mobile: '9301099887', address: 'Sudama Nagar, Indore', referringDoctor: 'Dr. R.K. Patel', billingGroupId: 'INSURANCE' },
    { patientId: 'PAT-10027', name: 'Mohammad Farooq', age: 51, gender: 'MALE', mobile: '9755033441', address: 'Khajrana, Indore', referringDoctor: 'Dr. A.H. Khan', billingGroupId: 'PRIVATE' },
    { patientId: 'PAT-10028', name: 'Geeta Bai Solanki', age: 66, gender: 'FEMALE', mobile: '9407022119', address: 'Banganga, Indore', referringDoctor: 'Dr. S.K. Verma', billingGroupId: 'AYUSHMAN BHARAT' }
  ];

  const createdPatients: Record<string, any> = {};
  for (const p of patientsData) {
    createdPatients[p.name] = await prisma.patient.create({ data: p });
  }
  console.log('✅ Patients seeded');

  // 7. Seed Sample Historical and Current Billing Records
  // We'll create 30 realistic records across the past 30 days
  const now = new Date();
  const sampleBillSpecs = [
    { pName: 'Rameshwar Patidar', sName: 'Complete Blood Count (CBC)', group: 'AYUSHMAN BHARAT', daysAgo: 0, qty: 1, rate: 350, disc: 0, visit: 'VHB26270004931', billNo: 'VHB26270004931' },
    { pName: 'Rameshwar Patidar', sName: 'Blood Sugar Fasting & PP', group: 'AYUSHMAN BHARAT', daysAgo: 0, qty: 1, rate: 150, disc: 0, visit: 'VHB26270004932', billNo: 'VHB26270004932' },
    { pName: 'Sunita Mehra', sName: 'Thyroid Profile (T3, T4, TSH)', group: 'PRIVATE', daysAgo: 0, qty: 1, rate: 550, disc: 50, visit: 'VHB26270004933', billNo: 'VHB26270004933' },
    { pName: 'Kishanlal Sharma', sName: 'Kidney Function Test (KFT)', group: 'CGHS', daysAgo: 1, qty: 1, rate: 700, disc: 0, visit: 'VHB26270004934', billNo: 'VHB26270004934' },
    { pName: 'Deepika Rathore', sName: 'Blood Sugar Fasting & PP', group: 'CORPORATE', daysAgo: 1, qty: 1, rate: 150, disc: 0, visit: 'VHB26270004935', billNo: 'VHB26270004935' }, // Matching prompt example!
    { pName: 'Anil Kumar Tiwari', sName: 'Liver Function Test (LFT)', group: 'AYUSHMAN BHARAT', daysAgo: 2, qty: 1, rate: 750, disc: 0, visit: 'VHB26270004936', billNo: 'VHB26270004936' },
    { pName: 'Pooja Chouhan', sName: 'Lipid Profile', group: 'INSURANCE', daysAgo: 3, qty: 1, rate: 650, disc: 50, visit: 'VHB26270004937', billNo: 'VHB26270004937' },
    { pName: 'Mohammad Farooq', sName: 'HbA1c (Glycosylated Hemoglobin)', group: 'PRIVATE', daysAgo: 4, qty: 1, rate: 450, disc: 0, visit: 'VHB26270004938', billNo: 'VHB26270004938' },
    { pName: 'Geeta Bai Solanki', sName: 'Creatinine Serum', group: 'AYUSHMAN BHARAT', daysAgo: 5, qty: 1, rate: 220, disc: 0, visit: 'VHB26270004939', billNo: 'VHB26270004939' },
    { pName: 'Sunita Mehra', sName: 'Vitamin D (25-OH)', group: 'PRIVATE', daysAgo: 6, qty: 1, rate: 1200, disc: 100, visit: 'VHB26270004940', billNo: 'VHB26270004940' },
    { pName: 'Kishanlal Sharma', sName: 'Urine Routine & Microscopic', group: 'CGHS', daysAgo: 7, qty: 1, rate: 180, disc: 0, visit: 'VHB26270004941', billNo: 'VHB26270004941' },
    { pName: 'Deepika Rathore', sName: 'Complete Blood Count (CBC)', group: 'CORPORATE', daysAgo: 8, qty: 1, rate: 350, disc: 35, visit: 'VHB26270004942', billNo: 'VHB26270004942' },
    { pName: 'Mohammad Farooq', sName: 'Vitamin B12', group: 'PRIVATE', daysAgo: 10, qty: 1, rate: 950, disc: 50, visit: 'VHB26270004943', billNo: 'VHB26270004943' },
    { pName: 'Anil Kumar Tiwari', sName: 'Creatinine Serum', group: 'AYUSHMAN BHARAT', daysAgo: 12, qty: 1, rate: 220, disc: 0, visit: 'VHB26270004944', billNo: 'VHB26270004944' },
    { pName: 'Rameshwar Patidar', sName: 'Lipid Profile', group: 'AYUSHMAN BHARAT', daysAgo: 15, qty: 1, rate: 650, disc: 0, visit: 'VHB26270004945', billNo: 'VHB26270004945' },
    { pName: 'Pooja Chouhan', sName: 'Thyroid Profile (T3, T4, TSH)', group: 'INSURANCE', daysAgo: 18, qty: 1, rate: 550, disc: 25, visit: 'VHB26270004946', billNo: 'VHB26270004946' },
    { pName: 'Geeta Bai Solanki', sName: 'Complete Blood Count (CBC)', group: 'AYUSHMAN BHARAT', daysAgo: 20, qty: 1, rate: 350, disc: 0, visit: 'VHB26270004947', billNo: 'VHB26270004947' },
    { pName: 'Sunita Mehra', sName: 'Dengue NS1 Antigen', group: 'PRIVATE', daysAgo: 22, qty: 1, rate: 600, disc: 0, visit: 'VHB26270004948', billNo: 'VHB26270004948' },
    { pName: 'Kishanlal Sharma', sName: 'Liver Function Test (LFT)', group: 'CGHS', daysAgo: 25, qty: 1, rate: 750, disc: 0, visit: 'VHB26270004949', billNo: 'VHB26270004949' },
    { pName: 'Anil Kumar Tiwari', sName: 'Complete Blood Count (CBC)', group: 'AYUSHMAN BHARAT', daysAgo: 28, qty: 1, rate: 350, disc: 0, visit: 'VHB26270004950', billNo: 'VHB26270004950' }
  ];

  let sno = 1;
  const createdBills = [];
  for (const spec of sampleBillSpecs) {
    const billDate = new Date(now.getTime() - spec.daysAgo * 24 * 60 * 60 * 1000);
    const gross = round2(spec.rate * spec.qty);
    const net = safeSub(gross, spec.disc);

    // Dynamic shares: SHDPL 52%, Veda 20%, Sodani 28%
    const shdplPct = 52.0;
    const vedaPct = 20.0;
    const sodaniPct = 28.0;

    const shdplAmt = safePercent(net, shdplPct);
    const vedaAmt = safePercent(net, vedaPct);
    const sodaniAmt = safePercent(net, sodaniPct);
    const remaining = safeSub(net, round2(shdplAmt + vedaAmt + sodaniAmt));

    const patient = createdPatients[spec.pName];
    const service = createdServices[spec.sName];

    // Visit creation
    await prisma.visit.upsert({
      where: { visitId: spec.visit },
      update: {},
      create: {
        visitId: spec.visit,
        patientId: patient.id,
        visitDate: billDate
      }
    });

    const isSettled = spec.daysAgo > 15;
    const bill = await prisma.billingRecord.create({
      data: {
        sNo: sno++,
        billingGroup: spec.group,
        billDate,
        billNo: spec.billNo,
        visitId: spec.visit,
        patientName: spec.pName,
        patientId: patient.id,
        serviceName: spec.sName,
        serviceId: service?.id,
        quantity: spec.qty,
        rate: spec.rate,
        rateType: 'STANDARD',
        totalAmount: gross,
        discountAmount: spec.disc,
        netAmount: net,
        vedaSharePercent: vedaPct,
        vedaShare: vedaAmt,
        sodaniSharePercent: sodaniPct,
        sodaniShare: sodaniAmt,
        shdpl: spec.rate,
        shdplPercentage: shdplPct,
        shdplAmount: shdplAmt,
        remainingRevenue: remaining,
        remarks: 'Sample migration baseline bill',
        settlementStatus: isSettled ? 'SETTLED' : 'PENDING',
        settledAmount: isSettled ? net : 0,
        createdById: operator.id,
        createdByName: operator.name
      }
    });
    createdBills.push(bill);
  }

  console.log(`✅ Seeded ${createdBills.length} Billing Records with accurate shares`);

  // 8. Seed a sample Settlement for older settled records
  const settledBills = createdBills.filter(b => b.settlementStatus === 'SETTLED');
  if (settledBills.length > 0) {
    const totalShdplSettled = settledBills.reduce((acc, b) => safeAdd(acc, b.shdplAmount), 0);
    const settlement = await prisma.settlement.create({
      data: {
        settlementRef: 'SET-2026-001',
        partnerName: 'SHDPL',
        totalAmount: totalShdplSettled,
        paymentDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        paymentMode: 'NEFT_RTGS',
        transactionRef: 'NEFT-SHDPL-9920144',
        notes: 'Bi-weekly payout reconciliation for SHDPL partner share',
        createdById: accountant.id,
        createdByName: accountant.name
      }
    });

    for (const b of settledBills) {
      await prisma.settlementItem.create({
        data: {
          settlementId: settlement.id,
          billingRecordId: b.id,
          partnerName: 'SHDPL',
          amount: b.shdplAmount
        }
      });
    }
    console.log(`✅ Seeded sample settlement for SHDPL (Amount: ₹${totalShdplSettled})`);
  }

  // 9. Initial Audit Log
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      userName: superAdmin.name,
      module: 'BILLING',
      action: 'CREATE',
      recordId: 'SYSTEM-INIT',
      newValue: JSON.stringify({ message: 'System initialized with baseline seed master data.' }),
      ipAddress: '127.0.0.1'
    }
  });

  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
