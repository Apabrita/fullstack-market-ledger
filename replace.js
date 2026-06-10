import fs from 'fs';
import path from 'path';

function replaceInDir(dirPath) {
  const dirFiles = fs.readdirSync(dirPath);
  for (const file of dirFiles) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const origContent = content;
      content = content.replace(/Trawler/g, 'Source');
      content = content.replace(/trawler/g, 'source');
      content = content.replace(/TRAWLER/g, 'SOURCE');
      if (content !== origContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

replaceInDir('src');
