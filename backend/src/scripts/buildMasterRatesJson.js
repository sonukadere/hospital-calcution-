const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function cleanName(raw) {
  if (!raw) return '';
  let name = String(raw).trim();
  if (name.includes('\n') || name.includes('\r')) {
    name = name.split(/[\r\n]+/)[0].replace(/\s+/g, ' ').trim();
  }
  return name;
}

function buildMasterRates() {
  const map = new Map();

  function upsert(name, rate, vedaShare, sodaniShare) {
    if (!name) return;
    const clean = cleanName(name);
    if (!clean) return;
    const key = clean.toLowerCase();
    
    map.set(key, {
      serviceName: clean,
      rate: Number(rate) || 0,
      sodaniShare: sodaniShare !== undefined ? sodaniShare : (100 - (vedaShare || 0)),
      vedaShare: vedaShare || 0
    });
  }

  // 1. Pathology 07.02.2024.xlsx
  const pathoPath = path.resolve(__dirname, '../../../sample_data/Pathology  07.02.2024.xlsx');
  if (fs.existsSync(pathoPath)) {
    console.log('Loading:', pathoPath);
    const wb = xlsx.readFile(pathoPath);
    
    if (wb.Sheets['Patho_XRay_TMT']) {
      const rows = xlsx.utils.sheet_to_json(wb.Sheets['Patho_XRay_TMT'], { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r && r[1]) {
          const name = cleanName(r[1]);
          const rate = Number(r[3]) || 0;
          const isXray = /X-?RAY/i.test(name);
          upsert(name, rate, isXray ? 30 : 0, isXray ? 70 : 100);
        }
      }
    }

    if (wb.Sheets['Profile test']) {
      const rows = xlsx.utils.sheet_to_json(wb.Sheets['Profile test'], { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        if (r[1] && r[4]) {
          upsert(r[1], r[4], 0, 100);
        }
        if (r[3]) {
          upsert(r[3], r[5] || r[4] || 0, 0, 100);
        }
      }
    }

    if (wb.Sheets['updated pathology test list']) {
      const rows = xlsx.utils.sheet_to_json(wb.Sheets['updated pathology test list'], { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r && r[1]) {
          upsert(r[1], r[3] || 0, 0, 100);
        }
      }
    }
  }

  // 2. CT Charges List-2025.xlsx
  const ctPath = path.resolve(__dirname, '../../../sample_data/CT Charges List-2025.xlsx');
  if (fs.existsSync(ctPath)) {
    console.log('Loading:', ctPath);
    const wb = xlsx.readFile(ctPath);
    const sheet = wb.Sheets['CT test rate list'] || wb.Sheets[wb.SheetNames[0]];
    if (sheet) {
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      for (let i = 4; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[1]) continue;
        const name = cleanName(r[1]);
        const rate = Number(r[5]) || Number(r[2]) || 0;
        upsert(name, rate, 20, 80);
        if (r[4]) {
          upsert(r[4], rate, 20, 80);
        }
      }
    }
  }

  // 3. X-Ray Charges 07.02.2024.xlsx
  const xrayPath = path.resolve(__dirname, '../../../sample_data/X-Ray Charges 07.02.2024.xlsx');
  if (fs.existsSync(xrayPath)) {
    console.log('Loading:', xrayPath);
    const wb = xlsx.readFile(xrayPath);
    const sheet = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]];
    if (sheet) {
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[1]) continue;
        upsert(r[1], r[3] || 0, 30, 70);
      }
    }
  }

  // 4. Sono, Color Doppler, Mammography Charges 07.02.2024.xlsx
  const sonoPath = path.resolve(__dirname, '../../../sample_data/Sono, Color Doppler, Mammography Charges 07.02.2024.xlsx');
  if (fs.existsSync(sonoPath)) {
    console.log('Loading:', sonoPath);
    const wb = xlsx.readFile(sonoPath);
    const sheet = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]];
    if (sheet) {
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[1]) continue;
        const name = cleanName(r[1]);
        const isXray = /X-?RAY/i.test(name);
        upsert(name, r[3] || 0, isXray ? 30 : 20, isXray ? 70 : 80);
      }
    }
  }

  // 5. Veda Hospital_Pathology Ujjain, _ updated List.xlsx (Override with latest Veda shares)
  const vedaPath = path.resolve(__dirname, '../../../sample_data/Veda Hospital_Pathology Ujjain, _ updated List.xlsx');
  if (fs.existsSync(vedaPath)) {
    console.log('Loading:', vedaPath);
    const wb = xlsx.readFile(vedaPath);

    if (wb.Sheets['updated pathology test list']) {
      const rows = xlsx.utils.sheet_to_json(wb.Sheets['updated pathology test list'], { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[1]) continue;
        const name = cleanName(r[1]);
        const rate = Number(r[3]) || 0;
        let vedaPct = 52;
        if (r[6] !== undefined && r[6] !== null && r[6] !== '') {
          const val = Number(r[6]);
          if (!isNaN(val)) {
            vedaPct = val <= 1 ? Math.round(val * 100) : Math.round(val);
          }
        }
        upsert(name, rate, vedaPct, 100 - vedaPct);
      }
    }

    if (wb.Sheets['Profile test']) {
      const rows = xlsx.utils.sheet_to_json(wb.Sheets['Profile test'], { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        if (r[1] && r[4]) {
          upsert(r[1], r[4], 52, 48);
        }
        if (r[3]) {
          upsert(r[3], r[5] || r[4] || 0, 52, 48);
        }
      }
    }
  }

  const result = Array.from(map.values());
  const outDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'masterRates.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`✅ Saved ${result.length} master rates to ${outPath}`);
}

buildMasterRates();
