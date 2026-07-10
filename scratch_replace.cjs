const fs = require('fs');
const path = require('path');

const directory = 'c:/Users/Q-CONSULTING/Documents/saas/Boutique OS/src/pages/admin';

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('supabase.rpc')) {
    // Determine relative path to src/lib/supabase-rpc
    // if in src/pages/admin/ -> ../../../lib/supabase-rpc
    // if in src/pages/admin/dashboard/ -> ../../../../lib/supabase-rpc
    const dirDepth = filePath.split(path.sep).length - 'c:/Users/Q-CONSULTING/Documents/saas/Boutique OS/src'.split('/').length;
    let importPath = '../'.repeat(dirDepth) + 'lib/supabase-rpc';
    
    // Check if callRpcWithRetry is already imported
    if (!content.includes('callRpcWithRetry')) {
      // Add import after the last import statement or at the top
      const importLine = `import { callRpcWithRetry } from '${importPath}';\n`;
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfLastImport = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, endOfLastImport + 1) + importLine + content.slice(endOfLastImport + 1);
      } else {
        content = importLine + content;
      }
    }

    // Replace supabase.rpc( with callRpcWithRetry(
    content = content.replace(/supabase\.rpc\(/g, 'callRpcWithRetry(');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

processDirectory(directory);
