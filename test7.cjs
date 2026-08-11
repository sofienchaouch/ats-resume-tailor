const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 1; // 1 means inside grid
let lines = code.split('\n');
for (let i = 901; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/<div(?=[\s>])/g) || []).length;
  const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - selfCloses - closes;
  if (i === 1446) console.log('Depth at 1447:', depth);
  if (i === 2020) console.log('Depth at 2021:', depth);
  if (i === 2021) console.log('Depth at 2022:', depth);
  if (i === 2022) console.log('Depth at 2023:', depth);
}
console.log('Final depth:', depth);
