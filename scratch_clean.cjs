const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/Q-CONSULTING/Documents/saas/Boutique OS/src';

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
  let changed = false;

  // Remove unused supabase import if 'supabase.' is not found
  if (content.includes("import { supabase } from") && !content.includes("supabase.")) {
    content = content.replace(/import \{ supabase \} from ['"].*lib\/supabase['"];?\n?/g, '');
    changed = true;
  }
  
  // Specific fix for ChurnSection unused recharts
  if (filePath.includes('ChurnSection.tsx')) {
    content = content.replace(/import \{ BarChart.*\} from 'recharts';\n?/g, '');
    changed = true;
  }

  // Specific fix for RevenueSection unused revenu_par_methode
  if (filePath.includes('RevenueSection.tsx')) {
    content = content.replace(' total_revenu, evolution_pct, revenu_par_plan, revenu_par_methode ', ' total_revenu, evolution_pct, revenu_par_plan ');
    changed = true;
  }

  // Specific fix for MaskedValue unused React
  if (filePath.includes('MaskedValue.tsx')) {
    content = content.replace(/import React from 'react';\n?/g, '');
    content = content.replace(/import React, \{/g, 'import {');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

processDirectory(srcDir);
