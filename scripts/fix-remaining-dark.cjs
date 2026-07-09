#!/usr/bin/env node
/**
 * Fix remaining dark theme elements after initial conversion
 */

const fs = require('fs');
const path = require('path');

const replacements = [
  // Fix text-white className on values (should be dark in light theme)
  {
    from: /className="text-xl\s+font-bold\s+text-white"/g,
    to: 'className="text-xl font-bold" style={{ color: "#014945" }}'
  },
  {
    from: /className="text-lg\s+font-bold\s+text-white"/g,
    to: 'className="text-lg font-bold" style={{ color: "#014945" }}'
  },
  {
    from: /className="text-white\s+font-bold\s+text-lg"/g,
    to: 'className="font-bold text-lg" style={{ color: "#014945" }}'
  },
  {
    from: /className="text-white\s+font-semibold"/g,
    to: 'className="font-semibold" style={{ color: "#1A2B1F" }}'
  },
  {
    from: /className="text-sm\s+font-medium\s+text-white"/g,
    to: 'className="text-sm font-medium" style={{ color: "#1A2B1F" }}'
  },
  {
    from: /className="text-sm\s+text-white"/g,
    to: 'className="text-sm" style={{ color: "#374151" }}'
  },
  // Fix text-white on inputs
  {
    from: /className="bg-transparent\s+text-white\s+text-sm/g,
    to: 'className="bg-transparent text-sm" style={{ color: "#1A2B1F" }}'
  },
  {
    from: /className="w-full\s+pl-9\s+pr-4\s+py-2\s+rounded-lg\s+text-sm\s+text-white/g,
    to: 'className="w-full pl-9 pr-4 py-2 rounded-lg text-sm" style={{ color: "#1A2B1F" }}'
  },
  // Fix option background colors in selects
  {
    from: /<option\s+value="all"\s+style=\{\{\s*background:\s*'#014945'\s*\}\}>/g,
    to: '<option value="all">'
  },
  {
    from: /<option\s+value="active"\s+style=\{\{\s*background:\s*'#014945'\s*\}\}>/g,
    to: '<option value="active">'
  },
  {
    from: /<option\s+value="pending"\s+style=\{\{\s*background:\s*'#014945'\s*\}\}>/g,
    to: '<option value="pending">'
  },
  {
    from: /<option\s+value="suspended"\s+style=\{\{\s*background:\s*'#014945'\s*\}\}>/g,
    to: '<option value="suspended">'
  },
  {
    from: /<option\s+value="verified"\s+style=\{\{\s*background:\s*'#014945'\s*\}\}>/g,
    to: '<option value="verified">'
  },
  {
    from: /<option\s+value="rejected"\s+style=\{\{\s*background:\s*'#014945'\s*\}\}>/g,
    to: '<option value="rejected">'
  },
  {
    from: /<option\s+value="completed"\s+style=\{\{\s*background:\s*'#014945'\s*\}\}>/g,
    to: '<option value="completed">'
  },
  {
    from: /<option\s+value="failed"\s+style=\{\{\s*background:\s*'#014945'\s*\}\}>/g,
    to: '<option value="failed">'
  },
  // Fix gradient button text colors
  {
    from: /style=\{\{\s*background:\s*'linear-gradient\(135deg,\s*#4DB049,\s*#196D43\)',\s*color:\s*'#1A2B1F'/g,
    to: "style={{ background: '#014945', color: '#FFFFFF'"
  },
  {
    from: /style=\{\{\s*background:\s*'linear-gradient\(135deg,\s*#22C55E,\s*#16A34A\)',\s*color:\s*'#1A2B1F'/g,
    to: "style={{ background: '#014945', color: '#FFFFFF'"
  },
  // Fix remaining text-white on plain elements
  {
    from: /<p\s+className="text-white\s+font-semibold/g,
    to: '<p className="font-semibold" style={{ color: "#1A2B1F" }}'
  },
  {
    from: /<p\s+className="text-white\s+text-sm/g,
    to: '<p className="text-sm" style={{ color: "#374151" }}'
  },
  {
    from: /<span\s+className="text-white/g,
    to: '<span className="" style={{ color: "#1A2B1F" }}'
  },
  {
    from: /<td\s+className="px-4\s+py-3\s+text-white/g,
    to: '<td className="px-4 py-3" style={{ color: "#374151" }}'
  },
  // Fix table header text colors
  {
    from: /style=\{\{\s*color:\s*'#6B7280',\s*fontFamily:\s*'Poppins,\s*sans-serif'\s*\}\}>\{h\}<\/th>/g,
    to: "style={{ color: '#6B7280', fontFamily: 'Poppins, sans-serif' }}>{h}</th>"
  },
  // Fix modal overlay
  {
    from: /style=\{\{\s*background:\s*'rgba\(0,0,0,0\.7\)',\s*backdropFilter:\s*'blur\(8px\)'\s*\}\}/g,
    to: "style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}"
  },
];

const pages = [
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

console.log('🔧 Fixing remaining dark theme elements...\n');

pages.forEach(processFile);

console.log('\n✨ Done!');
