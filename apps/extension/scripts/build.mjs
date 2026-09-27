// ─── apps/extension/scripts/build.mjs ───
// Build script using esbuild. Generates Chrome Manifest V3 and Firefox MV3 variants.

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const target = args.includes('--target')
  ? args[args.indexOf('--target') + 1]
  : 'chrome';
const watch = args.includes('--watch');

const outDir = path.join(ROOT, 'dist', target);

// ─── Manifest Generation ───

function generateManifest(target) {
  const base = {
    manifest_version: 3,
    name: 'SIH26171 Privacy Browser Agent',
    version: '0.1.0',
    description: 'Privacy-preserving visual browser agent for SIH 2026',
    permissions: [
      'activeTab',
      'tabs',
      'storage',
      'sidePanel',
    ],
    host_permissions: ['<all_urls>'],
    background: {
      service_worker: 'background.js',
      type: 'module',
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
        run_at: 'document_idle',
      },
    ],
    action: {
      default_popup: 'popup.html',
      default_icon: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png',
      },
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  };

  if (target === 'firefox') {
    // Firefox MV3 differences
    delete base.side_panel; // Firefox uses sidebar_action
    base.background = {
      scripts: ['background.js'],
      type: 'module',
    };
    // Firefox requires browser_specific_settings
    base.browser_specific_settings = {
      gecko: {
        id: 'sih26171-agent@example.com',
        strict_min_version: '109.0',
      },
    };
    // Replace sidePanel with sidebar_action
    base.sidebar_action = {
      default_panel: 'sidepanel.html',
      default_title: 'Agent Panel',
    };
    // Remove sidePanel permission (Firefox doesn't support it)
    base.permissions = base.permissions.filter(p => p !== 'sidePanel');
  }

  return base;
}

// ─── Build ───

async function build() {
  // Clean output
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // Write manifest
  const manifest = generateManifest(target);
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Common build options
  const commonOptions = {
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    sourcemap: true,
    minify: !watch,
    define: {
      'process.env.BUILD_TARGET': JSON.stringify(target),
    },
  };

  // Build background service worker
  const bgBuild = esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(ROOT, 'src/background/index.ts')],
    outfile: path.join(outDir, 'background.js'),
    format: 'esm',
  });

  // Build content script
  const contentBuild = esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(ROOT, 'src/content/index.ts')],
    outfile: path.join(outDir, 'content.js'),
    format: 'iife', // Content scripts must be IIFE
  });

  // Build popup
  const popupBuild = esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(ROOT, 'src/popup/popup.ts')],
    outfile: path.join(outDir, 'popup.js'),
    format: 'iife',
  });

  // Build sidepanel
  const sidepanelBuild = esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(ROOT, 'src/sidepanel/sidepanel.ts')],
    outfile: path.join(outDir, 'sidepanel.js'),
    format: 'iife',
  });

  await Promise.all([bgBuild, contentBuild, popupBuild, sidepanelBuild]);

  // Copy static assets
  const staticFiles = ['popup.html', 'sidepanel.html', 'styles.css'];
  for (const file of staticFiles) {
    const src = path.join(ROOT, 'src', file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(outDir, file));
    }
  }

  // Copy icons directory
  const iconsDir = path.join(ROOT, 'assets', 'icons');
  const outIcons = path.join(outDir, 'icons');
  if (fs.existsSync(iconsDir)) {
    fs.mkdirSync(outIcons, { recursive: true });
    for (const file of fs.readdirSync(iconsDir)) {
      fs.copyFileSync(path.join(iconsDir, file), path.join(outIcons, file));
    }
  }

  console.log(`✅ Built extension for ${target} → ${outDir}`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
