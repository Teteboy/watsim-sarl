#!/usr/bin/env node
/**
 * Script to convert admin/merchant pages from dark theme to light theme
 * This performs bulk replacements of common dark theme patterns to light theme
 */

const fs = require('fs');
const path = require('path');

// Define the replacements to perform
const replacements = [
  // Card/container backgrounds
  {
    from: /background:\s*'linear-gradient\(135deg,\s*#014A41\s*0%,\s*#014945\s*100%\)'/g,
    to: "background: '#FFFFFF'"
  },
  {
    from: /border:\s*'1px\s+solid\s+rgba\(77,176,89,0\.12\)'/g,
    to: "border: '1px solid #E8F2F1'"
  },
  {
    from: /border:\s*'1px\s+solid\s+rgba\(255,255,255,0\.12\)'/g,
    to: "border: '1px solid #E8F2F1'"
  },
  // Text colors - white to dark
  {
    from: /color:\s*'rgba\(255,255,255,0\.4\)'/g,
    to: "color: '#6B7280'"
  },
  {
    from: /color:\s*'rgba\(255,255,255,0\.5\)'/g,
    to: "color: '#6B7280'"
  },
  {
    from: /color:\s*'rgba\(255,255,255,0\.6\)'/g,
    to: "color: '#374151'"
  },
  {
    from: /color:\s*'rgba\(255,255,255,0\.7\)'/g,
    to: "color: '#374151'"
  },
  {
    from: /color:\s*'rgba\(255,255,255,0\.8\)'/g,
    to: "color: '#1A2B1F'"
  },
  {
    from: /color:\s*'rgba\(255,255,255,0\.9\)'/g,
    to: "color: '#1A2B1F'"
  },
  {
    from: /color:\s*'#ffffff'/gi,
    to: "color: '#1A2B1F'"
  },
  {
    from: /color:\s*'#fff'/g,
    to: "color: '#1A2B1F'"
  },
  {
    from: /className="text-white"/g,
    to: 'className="" style={{ color: "#1A2B1F" }}'
  },
  // Input backgrounds
  {
    from: /background:\s*'rgba\(255,255,255,0\.05\)'/g,
    to: "background: '#F5FAF5'"
  },
  {
    from: /background:\s*'rgba\(255,255,255,0\.06\)'/g,
    to: "background: '#F5FAF5'"
  },
  {
    from: /border:\s*'1px\s+solid\s+rgba\(255,255,255,0\.08\)'/g,
    to: "border: '1px solid #E8F2F1'"
  },
  {
    from: /border:\s*'1px\s+solid\s+rgba\(255,255,255,0\.1\)'/g,
    to: "border: '1px solid #D1E8D1'"
  },
  // Table borders
  {
    from: /borderBottom:\s*'1px\s+solid\s+rgba\(255,255,255,0\.06\)'/g,
    to: "borderBottom: '1px solid #E8F2F1'"
  },
  {
    from: /borderBottom:\s*'1px\s+solid\s+rgba\(255,255,255,0\.04\)'/g,
    to: "borderBottom: '1px solid #F0F7F0'"
  },
  // Placeholder colors in className
  {
    from: /placeholder-white\/30/g,
    to: "placeholder:text-[#9CA3AF]"
  },
  // Search icon color
  {
    from: /text-white\/40/g,
    to: "text-[#9CA3AF]"
  },
];

// Files to process
const adminPages = [
  'src/pages/admin/users/page.tsx',
  'src/pages/admin/merchants/page.tsx',
  'src/pages/admin/transactions/page.tsx',
  'src/pages/admin/bnpl/page.tsx',
  'src/pages/admin/wallets/page.tsx',
  'src/pages/admin/accounting/page.tsx',
  'src/pages/admin/reports/page.tsx',
  'src/pages/admin/settings/page.tsx',
  'src/pages/admin/notifications/page.tsx',
  'src/pages/admin/publicities/page.tsx',
  'src/pages/admin/disputes/page.tsx',
];

const merchantPages = [
  'src/pages/merchant/page.tsx',
  'src/pages/merchant/products/page.tsx',
  'src/pages/merchant/orders/page.tsx',
  'src/pages/merchant/wallet/page.tsx',
  'src/pages/merchant/analytics/page.tsx',
  'src/pages/merchant/bnpl/page.tsx',
  'src/pages/merchant/settings/page.tsx',
  'src/pages/merchant/notifications/page.tsx',
  'src/pages/merchant/users/page.tsx',
];

const allPages = [...adminPages, ...merchantPages];

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping (not found): ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  replacements.forEach(({ from, to }) => {
    if (from.test(content)) {
      content = content.replace(from, to);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Updated: ${filePath}`);
  } else {
    console.log(`⏭️  No changes: ${filePath}`);
  }
}

console.log('🎨 Converting admin and merchant pages to light theme...\n');

allPages.forEach(processFile);

console.log('\n✨ Done! Please review the changes and adjust any remaining dark theme elements manually.');
