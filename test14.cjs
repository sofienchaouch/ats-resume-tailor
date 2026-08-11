const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 0; 
let lines = code.split('\n');
for (let i = 853; i < 1915; i++) {
  const line = lines[i];
  const opens = (line.match(/<div(?=[\s>])/g) || []).length;
  const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - selfCloses - closes;
  if (i === 902) console.log('Depth at 903:', depth);
  if (i === 1447) console.log('Depth at 1448:', depth);
  if (i === 1450) console.log('Depth at 1451:', depth);
  if (i === 1458) console.log('Depth at 1459:', depth);
  if (i === 1850) console.log('Depth at 1851:', depth);
  if (i === 1853) console.log('Depth at 1854:', depth);
  if (i === 1912) console.log('Depth at 1913:', depth);
}
console.log('Final depth at 1914:', depth);
