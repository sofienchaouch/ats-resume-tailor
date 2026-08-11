const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 0;
let lines = code.split('\n');
for (let i = 853; i < 2024; i++) { // Start at return
  const open = (lines[i].match(/<div/g) || []).length;
  const close = (lines[i].match(/<\/div>/g) || []).length;
  depth += open - close;
}
console.log('Depth at 2023:', depth);
