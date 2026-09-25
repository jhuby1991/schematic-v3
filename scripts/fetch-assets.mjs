#!/usr/bin/env node
/**
 * Vendor component images into public/components/.
 *
 * The previous tool hot-linked every image from s.myrako.com, so the palette
 * would have gone blank the day those paths moved, and a public tool sent
 * traffic at a CDN it did not control. Run this once and commit the result:
 * the repo then builds and runs with no external dependency at all.
 *
 *   npm run fetch-assets
 *
 * Images already present are left alone. Pass --force to refresh them.
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'public', 'components');
const BASE = process.env.ASSET_SOURCE ?? 'https://s.myrako.com/Schematic/Configure';

/**
 * Local filename -> path on the source CDN.
 * Local names are lowercase and hyphenated; the source uses its own casing.
 */
const ASSETS = {
  'rak8.png': 'RAK8.png',
  'rak-link.png': 'LINK.png',
  'rak-star.png': 'RAKSTAR.png',
  'din-4c.png': 'din/d4c.png',
  'din-4t.png': 'din/d4t.png',
  'din-8s.png': 'din/d8s.png',
  'din-link.png': 'din/dlink.png',
  'din-psu.png': 'din/dpsu.png',
  'din-dli.png': 'din/dli.png',
  'wcm.png': 'WCM.png',
  'wk-eos.png': 'WKEOS.png',
  'wk-mod.png': 'WKMOD.png',
  'rcm.png': 'wireless%20inputs/rcm070.png',
  'hub.png': 'HUB.png',
  'pir.png': 'wkpir.png',
};

const force = process.argv.includes('--force');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchOne(local, remote) {
  const target = join(OUT, local);
  if (!force && (await exists(target))) return { local, status: 'kept' };

  const url = `${BASE}/${remote}`;
  const response = await fetch(url);
  if (!response.ok) return { local, status: `failed (HTTP ${response.status})` };

  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return { local, status: `failed (not an image: ${type})` };

  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return { local, status: 'downloaded' };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`Fetching component images from ${BASE}\n`);

  const results = [];
  for (const [local, remote] of Object.entries(ASSETS)) {
    try {
      results.push(await fetchOne(local, remote));
    } catch (error) {
      results.push({ local, status: `failed (${error.message})` });
    }
  }

  for (const { local, status } of results) {
    console.log(`  ${status.startsWith('failed') ? '✗' : '✓'} ${local.padEnd(16)} ${status}`);
  }

  const failed = results.filter((r) => r.status.startsWith('failed'));
  console.log(`\n${results.length - failed.length}/${results.length} available in public/components/`);

  if (failed.length) {
    console.log(
      '\nMissing images render as a red placeholder naming the part, so the tool\n' +
        'still works and the gap is obvious. Add them by hand or rerun with --force.',
    );
    process.exitCode = 1;
  }
}

main();
