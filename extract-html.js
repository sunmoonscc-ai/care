import fs from 'fs';
import path from 'path';

const screensDir = './screens';
const folders = fs.readdirSync(screensDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

for (const folder of folders) {
  const codePath = path.join(screensDir, folder, 'code.html');
  if (fs.existsSync(codePath)) {
    const raw = fs.readFileSync(codePath, 'utf-8');
    try {
      const parsed = JSON.parse(raw);
      if (parsed.dataString) {
        fs.writeFileSync(codePath, parsed.dataString, 'utf-8');
        console.log(`Extracted dataString for ${folder} (${parsed.dataString.length} chars)`);
      }
    } catch (e) {
      // not json or already pure html
    }
  }
}

