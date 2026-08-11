const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 0; 
let lines = code.split('\n');
for (let i = 853; i < 2020; i++) {
  const line = lines[i];
  const opens = (line.match(/<div(?=[\s>])/g) || []).length;
  const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  depth += opens - selfCloses - closes;
  if (depth < 2 && i > 900) {
    console.log('Depth dropped below 2 at line:', i + 1, 'text:', line);
    break;
  }
}
