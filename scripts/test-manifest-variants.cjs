const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const distChrome = path.join(ROOT, 'apps/extension/dist/chrome');
const manifestPath = path.join(distChrome, 'manifest.json');

const variants = {
  A: {
    name: 'Minimal: activeTab + storage + sidePanel',
    permissions: ['activeTab', 'storage', 'sidePanel'],
    host_permissions: ['<all_urls>'],
  },
  B: {
    name: 'Recommended: activeTab + tabs + storage + sidePanel (scripting removed)',
    permissions: ['activeTab', 'tabs', 'storage', 'sidePanel'],
    host_permissions: ['<all_urls>'],
  },
  C: {
    name: 'Current Baseline: activeTab + tabs + scripting + storage + sidePanel',
    permissions: ['activeTab', 'tabs', 'scripting', 'storage', 'sidePanel'],
    host_permissions: ['<all_urls>'],
  },
};

console.log('=== TESTING MANIFEST PERMISSION VARIANTS ===\n');

for (const [key, v] of Object.entries(variants)) {
  console.log(`Testing Variant ${key}: ${v.name}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.permissions = v.permissions;
  manifest.host_permissions = v.host_permissions;

  // Validate manifest structure
  const hasSidePanel = manifest.permissions.includes('sidePanel') && manifest.side_panel;
  const hasStorage = manifest.permissions.includes('storage');
  const hasTabs = manifest.permissions.includes('tabs');
  const hasActiveTab = manifest.permissions.includes('activeTab');
  const hasScripting = manifest.permissions.includes('scripting');

  console.log(`  - sidePanel permission & config: ${hasSidePanel ? 'VALID' : 'INVALID'}`);
  console.log(`  - storage permission: ${hasStorage ? 'PRESENT' : 'ABSENT'}`);
  console.log(`  - tabs permission: ${hasTabs ? 'PRESENT' : 'ABSENT'}`);
  console.log(`  - activeTab permission: ${hasActiveTab ? 'PRESENT' : 'ABSENT'}`);
  console.log(`  - scripting permission: ${hasScripting ? 'PRESENT' : 'ABSENT'}`);
  console.log(`  - Manifest bytes: ${JSON.stringify(manifest).length}`);
  console.log('');
}
