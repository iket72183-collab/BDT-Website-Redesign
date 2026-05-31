#!/usr/bin/env node
/**
 * Render SVG sources in assets/sources/ to the PNG files Expo expects.
 *
 * Run after editing any SVG in assets/sources/:
 *
 *   node tools/generate-android-assets.mjs
 *
 * Outputs go to apps/mobile/assets/. The PNGs are committed alongside the
 * SVGs so CI / EAS builds don't depend on this script running.
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcesDir = resolve(here, '..', 'assets', 'sources');
const outDir = resolve(here, '..', 'assets');

mkdirSync(outDir, { recursive: true });

/**
 * Each entry renders one SVG source into one PNG output at a target width.
 * The SVG's intrinsic viewBox controls aspect ratio — Resvg fits height
 * automatically.
 */
const ASSETS = [
  // 1024×1024 — Expo app icon. iOS and Android use this as the base.
  { source: 'icon.svg',              out: 'icon.png',              width: 1024 },
  // 1024×1024 — Android adaptive icon foreground (safe-zone is inner 66%).
  // Composited over `adaptiveIcon.backgroundColor` from app.json.
  { source: 'adaptive-icon.svg',     out: 'adaptive-icon.png',     width: 1024 },
  // 1242×2436 — iPhone X / Expo splash. Auto-scaled for other devices.
  { source: 'splash.svg',            out: 'splash.png',            width: 1242 },
  // 96×96 — Android notification tray icon. Monochrome white on transparent.
  // Android tints with the color from app.json plugins/expo-notifications.
  { source: 'notification-icon.svg', out: 'notification-icon.png', width: 96  },
];

let failures = 0;
for (const { source, out, width } of ASSETS) {
  const svgPath = join(sourcesDir, source);
  const outPath = join(outDir, out);
  try {
    const svg = readFileSync(svgPath, 'utf8');
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
      // Allow the system font fallback. Brand fonts (Playfair Display, Inter)
      // aren't installed on most build machines — Resvg picks a serif/sans
      // fallback which matches the brand character close enough for icons.
      font: { loadSystemFonts: true },
      background: 'rgba(0,0,0,0)',
    });
    const png = resvg.render().asPng();
    writeFileSync(outPath, png);
    console.log(`  ✓ ${out.padEnd(28)} ${png.length.toLocaleString()} bytes`);
  } catch (err) {
    failures += 1;
    console.error(`  ✗ ${out}: ${err.message}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} asset(s) failed.`);
  process.exit(1);
}
console.log(`\nDone. ${ASSETS.length} asset(s) written to apps/mobile/assets/.`);
