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
      
      // Upgrade UX theme to a modern Neutral/Zinc aesthetic
      content = content.replace(/bg-slate-/g, 'bg-zinc-');
      content = content.replace(/border-slate-/g, 'border-zinc-');
      content = content.replace(/text-slate-/g, 'text-zinc-');
      content = content.replace(/divide-slate-/g, 'divide-zinc-');
      content = content.replace(/from-slate-/g, 'from-zinc-');
      content = content.replace(/to-slate-/g, 'to-zinc-');
      content = content.replace(/via-slate-/g, 'via-zinc-');
      
      content = content.replace(/ shadow-xl/g, ' shadow-2xl shadow-black/10');
      content = content.replace(/ rounded-xl/g, ' rounded-2xl');
      content = content.replace(/ rounded-lg/g, ' rounded-xl');
      
      if (content !== origContent) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

replaceInDir('src');
