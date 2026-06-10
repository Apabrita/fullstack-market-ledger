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
      content = content.replace(/(-[A-Za-z]+)-850/g, '$1-800');
      content = content.replace(/(-[A-Za-z]+)-750/g, '$1-700');
      content = content.replace(/(-[A-Za-z]+)-650/g, '$1-600');
      content = content.replace(/(-[A-Za-z]+)-505/g, '$1-500');
      content = content.replace(/(-[A-Za-z]+)-450/g, '$1-500');
      content = content.replace(/(-[A-Za-z]+)-250/g, '$1-200');
      content = content.replace(/(-[A-Za-z]+)-205/g, '$1-200');
      content = content.replace(/(-[A-Za-z]+)-905/g, '$1-900');
      if (content !== origContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

replaceInDir('src');
