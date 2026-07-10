const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/pages/Stock.tsx',
  'src/pages/PortalClient.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Caisse.tsx',
  'src/pages/Ardoise.tsx',
  'src/pages/admin/AdminSubscriptions.tsx',
  'src/pages/admin/AdminBoutiques.tsx',
  'src/pages/admin/dashboard/ActiveDormantBoutiques.tsx',
  'src/pages/admin/dashboard/LTVFunnelSection.tsx',
  'src/pages/admin/dashboard/GeoMap.tsx',
  'src/pages/admin/dashboard/RevenueSection.tsx',
  'src/features/ardoise/useArdoise.ts'
];

for (const relPath of filesToUpdate) {
  const filePath = path.join('c:/Users/Q-CONSULTING/Documents/saas/Boutique OS', relPath);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Add import if not present
  if (content.includes('Intl.NumberFormat') || content.includes('formatMontantCompact')) {
    if (!content.includes('import { formatMontantCompact } from')) {
      // Find how many levels deep we are to import from src/lib/format
      const depth = relPath.split('/').length - 2; // src/pages/Stock.tsx -> depth 1
      const relativeImportPath = depth === 0 ? './lib/format' : '../'.repeat(depth) + 'lib/format';
      
      const importStatement = `import { formatMontantCompact } from '${relativeImportPath}';\n`;
      // Insert after the last import
      const lastImportIndex = content.lastIndexOf('import ');
      const nextLineIndex = content.indexOf('\n', lastImportIndex);
      content = content.slice(0, nextLineIndex + 1) + importStatement + content.slice(nextLineIndex + 1);
    }
  }

  // Replace `new Intl.NumberFormat('fr-FR').format(X)` with `formatMontantCompact(X)`
  const frFRRegex = /new\s+Intl\.NumberFormat\(['"]fr-FR['"]\)\.format\(([^)]+)\)/g;
  if (frFRRegex.test(content)) {
    content = content.replace(frFRRegex, 'formatMontantCompact($1)');
    changed = true;
  }

  // Replace `new Intl.NumberFormat('fr-SN', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(X)`
  // with `formatMontantCompact(X) + ' FCFA'`
  const frSNRegex = /new\s+Intl\.NumberFormat\(['"]fr-SN['"],\s*\{\s*style:\s*['"]currency['"],\s*currency:\s*['"]XOF['"],\s*maximumFractionDigits:\s*0\s*\}\)\.format\(([^)]+)\)/g;
  if (frSNRegex.test(content)) {
    content = content.replace(frSNRegex, "formatMontantCompact($1) + ' F'");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${relPath}`);
  }
}
