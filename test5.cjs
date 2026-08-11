const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 0;
let lines = code.split('\n');
for (let i = 853; i < lines.length; i++) {
  // we must also consider tags that are closed on the same line like <div />
  const line = lines[i];
  let localDepth = 0;
  
  // count <div... > and </div>
  const opens = (line.match(/<div(?=[\s>])/g) || []).length;
  const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  
  depth += opens - selfCloses - closes;
  if (depth === 0 && opens - selfCloses - closes !== 0) {
    console.log('Depth hit 0 at line:', i + 1, 'text:', line);
  }
}
