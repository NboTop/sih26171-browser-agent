const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '../apps/extension/dist/chrome');
const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js') && !f.endsWith('.map'));

const patterns = [
  { name: 'eval(', regex: /eval\s*\(/g },
  { name: 'new Function', regex: /new\s+Function\s*\(/g },
  { name: 'executeScript', regex: /executeScript/g },
  { name: 'chrome.scripting', regex: /chrome\.scripting/g },
  { name: 'document.cookie', regex: /document\.cookie/g },
  { name: 'localStorage', regex: /localStorage/g },
  { name: 'sessionStorage', regex: /sessionStorage/g },
  { name: 'password value read', regex: /\.type\s*===\s*['"]password['"][\s\S]{0,50}\.value/g },
  { name: 'remote script URL', regex: /https?:\/\/[^\s'"]+\.js\b/g },
  { name: 'image_base64 non-empty', regex: /image_base64\s*:\s*['"][^'"]+['"]/g },
  { name: 'raw screenshot pixels sent', regex: /raw_pixels_sent\s*:\s*true/g },
];

console.log('=== STATIC SECURITY SCAN OF GENERATED CHROME BUNDLE ===');
console.log('Directory:', distDir);
console.log('Files examined:', jsFiles.join(', '));
console.log('');

let totalFindings = 0;

for (const file of jsFiles) {
  const content = fs.readFileSync(path.join(distDir, file), 'utf8');
  const lines = content.split('\n');

  for (const p of patterns) {
    let match;
    p.regex.lastIndex = 0;
    while ((match = p.regex.exec(content)) !== null) {
      totalFindings++;
      const upTo = content.substring(0, match.index);
      const lineNum = upTo.split('\n').length;
      const snippet = lines[lineNum - 1]?.trim().substring(0, 140);
      console.log(`[MATCH] ${file}:${lineNum} - Pattern: ${p.name}`);
      console.log(`   Snippet: ${snippet}`);
    }
  }
}

console.log('\n--- SCAN SUMMARY ---');
if (totalFindings === 0) {
  console.log('✅ ZERO SECURITY PATTERNS MATCHED.');
} else {
  console.log(`Total pattern occurrences matched: ${totalFindings}`);
}
