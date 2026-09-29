const fs = require('fs');
const path = require('path');
const http = require('http');

async function uploadAndExportTest() {
  const filePath = path.resolve(__dirname, '../../../sample_data/PATHOLOGY 08-26.xlsx');
  if (!fs.existsSync(filePath)) {
    console.log('Sample file not found at:', filePath);
    return;
  }

  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const fileData = fs.readFileSync(filePath);
  const filename = path.basename(filePath);

  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
  body += `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;

  const payloadHeader = Buffer.from(body, 'utf-8');
  const payloadFooter = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const fullBody = Buffer.concat([payloadHeader, fileData, payloadFooter]);

  const req = http.request({
    hostname: 'localhost',
    port: process.env.PORT || 5005,
    path: '/api/billing/upload',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': fullBody.length,
    }
  }, (res) => {
    let resData = '';
    res.on('data', chunk => resData += chunk);
    res.on('end', () => {
      console.log('Upload Response status:', res.statusCode);
      try {
        const json = JSON.parse(resData);
        console.log('✅ Upload Success:');
        console.log('   - Total Records:', json.totalRecords);
        console.log('   - Matched:', json.matchedCount);
        console.log('   - Unmatched:', json.unmatchedCount);
        console.log('   - Billing Month:', json.billingMonth);
        console.log('   - Sample Row Rate & Shares:', json.sampleRows && json.sampleRows[0] ? {
          service: json.sampleRows[0].serviceName,
          rate: json.sampleRows[0].masterRate,
          vedaShare: json.sampleRows[0].vedaShare,
          sodaniShare: json.sampleRows[0].sodaniShare
        } : 'N/A');
      } catch (e) {
        console.log('Response body:', resData);
      }
    });
  });

  req.on('error', console.error);
  req.write(fullBody);
  req.end();
}

uploadAndExportTest();
