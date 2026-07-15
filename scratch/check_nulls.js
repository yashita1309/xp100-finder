const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../data/iocl_premium.json');
const stations = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

let nullCount = 0;
stations.forEach((s, idx) => {
  const fields = ['stationName', 'city', 'salesArea', 'divisionalOffice', 'stateOffice', 'roCode'];
  fields.forEach(field => {
    if (s[field] === null || s[field] === undefined) {
      console.log(`Station at index ${idx} (${s.roCode || 'no roCode'}): field '${field}' is null/undefined`);
      nullCount++;
    }
  });
});

console.log(`Total null/undefined instances: ${nullCount}`);
