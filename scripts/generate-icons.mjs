#!/usr/bin/env node
// ─── scripts/generate-icons.mjs ───
// Generates placeholder extension icons (SVG-in-PNG via Canvas).
// Run: node scripts/generate-icons.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'apps', 'extension', 'assets', 'icons');

fs.mkdirSync(OUT, { recursive: true });

// Create simple SVG icons at different sizes
const sizes = [16, 48, 128];

for (const size of sizes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${size * 0.45}" font-weight="bold">🛡</text>
</svg>`;

  // Save as SVG (can be converted to PNG with a tool like sharp or Inkscape)
  fs.writeFileSync(path.join(OUT, `icon${size}.svg`), svg);

  // For now, also create a minimal PNG-like placeholder
  // In production, use: npx svgexport icon.svg icon.png
  console.log(`Created icon${size}.svg`);
}

// Create a simple 1x1 PNG as placeholder for each size
// (Real icons should be designed properly)
for (const size of sizes) {
  // Minimal valid PNG header (1x1 transparent pixel)
  const png = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
    0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00,
    0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, // IEND chunk
    0x60, 0x82,
  ]);
  fs.writeFileSync(path.join(OUT, `icon${size}.png`), png);
  console.log(`Created icon${size}.png (placeholder)`);
}

console.log('\n✅ Icons generated. Replace with designed icons before release.');
