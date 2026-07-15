import fs from 'fs';
import path from 'path';

const SRC_DIR = './src';

const replacements = [
  // Backgrounds
  { from: /bg-slate-950/g, to: 'bg-background' },
  { from: /bg-slate-900/g, to: 'bg-surface' },
  { from: /bg-slate-800/g, to: 'bg-surface-hover' },
  { from: /bg-slate-700/g, to: 'bg-surface-active' },
  
  // Borders
  { from: /border-slate-800/g, to: 'border-border' },
  { from: /border-slate-700/g, to: 'border-border-light' },
  
  // Text
  { from: /text-slate-50/g, to: 'text-text-main' },
  { from: /text-slate-200/g, to: 'text-text-secondary' },
  { from: /text-slate-300/g, to: 'text-text-tertiary' },
  { from: /text-slate-400/g, to: 'text-text-muted' },
  { from: /text-slate-500/g, to: 'text-text-dark' },
  { from: /text-slate-600/g, to: 'text-text-darker' },
  
  // Primary Brand (Indigo)
  { from: /bg-indigo-600/g, to: 'bg-primary' },
  { from: /hover:bg-indigo-700/g, to: 'hover:bg-primary-hover' },
  { from: /text-indigo-400/g, to: 'text-primary-light' },
  { from: /text-indigo-300/g, to: 'text-primary-lighter' },
  { from: /border-indigo-500/g, to: 'border-primary' },
  { from: /bg-indigo-500\/20/g, to: 'bg-primary/20' },
  
  // Accent Brand (Blue)
  { from: /bg-blue-600/g, to: 'bg-accent' },
  { from: /hover:bg-blue-700/g, to: 'hover:bg-accent-hover' },
  { from: /border-blue-500/g, to: 'border-accent' },
  
  // Danger (Rose)
  { from: /rose-500/g, to: 'danger' },
  { from: /rose-400/g, to: 'danger-light' },
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      replacements.forEach(({ from, to }) => {
        if (from.test(content)) {
          content = content.replace(from, to);
          modified = true;
        }
      });
      
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated theme classes in: ${fullPath}`);
      }
    }
  }
}

processDirectory(SRC_DIR);
console.log('Theme migration complete!');
