const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 1; // start inside grid
let lines = code.split('\n');
for (let i = 1430; i <= 1460; i++) {
  const line = lines[i];
  const opens = (line.match(/<div(?=[\s>])/g) || []).length;
  const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - selfCloses - closes;
  console.log(i + 1, depth, line);
}
