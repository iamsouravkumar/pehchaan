/**
 * Scrubs CDN URLs from the exported site, then proves none are left.
 *
 * The rewrite is half the value; the assertion is the other half. "Zero network
 * requests at runtime" is checked today by remembering to grep the bundle after
 * every dependency bump, which is exactly the kind of check that gets skipped at
 * 2am before a deadline. This makes the build fail instead (TRD §7).
 *
 * Runs after `next build` as `postbuild`, over out/.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { findCdnUrls, scrub } from './scrub.mjs';

const ROOT = 'out';
const TEXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.txt']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

let scanned = 0;
let rewritten = 0;
const remaining = [];

for await (const path of walk(ROOT)) {
  if (!TEXT.has(extname(path))) continue;
  scanned++;

  const source = await readFile(path, 'utf8');
  const found = findCdnUrls(source);
  if (found.length === 0) continue;

  const cleaned = scrub(source);
  await writeFile(path, cleaned);
  rewritten++;
  console.log(`scrubbed ${path}: ${found.join(', ')}`);

  // Belt and braces: re-read what we wrote rather than trusting the replace.
  const after = findCdnUrls(await readFile(path, 'utf8'));
  if (after.length) remaining.push(`${path}: ${after.join(', ')}`);
}

console.log(`checked ${scanned} files, rewrote ${rewritten}`);

if (remaining.length) {
  console.error('\nCDN URLs survived the scrub:');
  for (const line of remaining) console.error(`  ${line}`);
  console.error('\nThe zero-network claim does not hold. Not shipping this build.');
  process.exit(1);
}
