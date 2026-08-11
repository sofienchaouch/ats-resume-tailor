const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 1; 
let lines = code.split('\n');
for (let i = 1692; i <= 1850; i++) {
  const line = lines[i];
  const opens = (line.match(/<div(?=[\s>])/g) || []).length;
  const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - selfCloses - closes;
  if (i === 1693) console.log('Depth at 1694:', depth);
}
console.log('Depth at 1850:', depth);
