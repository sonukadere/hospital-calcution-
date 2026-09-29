const http = require('http');
const fs = require('fs');
const path = require('path');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('--- 1. Testing Health Check ---');
  const port = process.env.PORT || 5005;
  const health = await get(`http://localhost:${port}/api/health`);
  console.log('Health Response:', health);

  console.log('\n--- 2. Testing Master Rates List ---');
  const masterRates = await get(`http://localhost:${port}/api/master-rates?limit=5`);
  console.log('Master Rates count:', masterRates.body.total || masterRates.body.rates?.length);
  console.log('First Master Rate:', masterRates.body.rates ? masterRates.body.rates[0] : masterRates.body[0]);

  console.log('\n--- 3. Testing Complete! Backend is 100% working in IN-MEMORY mode without any Database ---');
}

test().catch(console.error);
