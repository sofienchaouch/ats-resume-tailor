const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 0; 
let lines = code.split('\n');
for (let i = 1458; i < 1850; i++) {
  const line = lines[i];
  const opens = (line.match(/<div(?=[\s>])/g) || []).length;
  const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - selfCloses - closes;
  if (depth < 1) {
    console.log('Depth dropped to 0 at:', i + 1, line);
  }
}
console.log('Final depth of LinkedIn Panel:', depth);
