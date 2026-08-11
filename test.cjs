const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 0;
let lines = code.split('\n');
for (let i = 853; i < lines.length; i++) { // Start at return
  const open = (lines[i].match(/<div/g) || []).length;
  const close = (lines[i].match(/<\/div>/g) || []).length;
  depth += open - close;
  if (depth === 0 && open === 0 && close === 1) { // Found closing div for root
    console.log('Root div closed at', i + 1, 'Line text:', lines[i]);
  }
}
console.log('Final depth from return:', depth);
