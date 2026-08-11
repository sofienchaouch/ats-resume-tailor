const fs = require('fs');
const code = fs.readFileSync('src/components/ApplicationIntegrationsHub.tsx', 'utf8');
let depth = 0;
let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  const open = (lines[i].match(/<div/g) || []).length;
  const close = (lines[i].match(/<\/div>/g) || []).length;
  depth += open - close;
  if (i > 850) {
    if (depth < 0) {
      console.log('Depth negative at', i + 1);
      break;
    }
  }
}
console.log('Final depth:', depth);
