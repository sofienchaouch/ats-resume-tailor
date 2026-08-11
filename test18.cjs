const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 0; 
let lines = code.split('\n');
for (let i = 853; i < lines.length; i++) {
  if (i === 1849) continue; // skip 1850
  
  const line = lines[i];
  const opens = (line.match(/<div(?=[\s>])/g) || []).length;
  const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - selfCloses - closes;
}
console.log('Final depth without 1850:', depth);
