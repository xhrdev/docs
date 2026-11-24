/**
 * Regenerates the self-hosted webfonts in `src/public/fonts` and the
 * `@font-face` block in `.vitepress/theme/fonts.css`.
 *
 *     node scripts/fetch-fonts.mjs
 *
 * Google Fonts serves a different `src:` per User-Agent, so the request below
 * pretends to be a current Chrome in order to get woff2 back rather than a
 * legacy format. Only the latin and latin-ext subsets are kept: the docs are
 * English, and `unicode-range` means latin-ext costs nothing until a page
 * actually uses a character from it.
 *
 * See the header comment in `.vitepress/theme/fonts.css` for why the roman
 * weights are variable and the italic is static.
 */
// Every path below is derived from this file's own location; there is no
// caller-supplied input to sanitise.
/* eslint-disable security/detect-non-literal-fs-filename */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const root = fileURLToPath(new URL('../', import.meta.url));
const fontsDir = path.join(root, 'src/public/fonts');
const cssFile = path.join(root, '.vitepress/theme/fonts.css');

const SPECS = [
  ['dm-sans', 'family=DM+Sans:opsz,wght@9..40,400..700'],
  ['dm-sans-italic', 'family=DM+Sans:ital,opsz,wght@1,9..40,400'],
  ['jetbrains-mono', 'family=JetBrains+Mono:wght@400..700'],
];

const FACE = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;

const faces = [];
for (const [name, spec] of SPECS) {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?${spec}&display=swap`, {
      headers: { 'User-Agent': UA },
    })
  ).text();

  for (const [, subset, body] of css.matchAll(FACE)) {
    if (!/^latin(-ext)?$/.test(subset)) continue;
    faces.push({
      body: Buffer.from(
        await (await fetch(/src:\s*url\((\S+?)\)/.exec(body)[1])).arrayBuffer()
      ),
      family: /font-family:\s*'([^']+)'/.exec(body)[1],
      file: `${name}-${subset}.woff2`,
      range: /unicode-range:\s*([^;]+);/.exec(body)[1].trim(),
      style: /font-style:\s*([^;]+);/.exec(body)[1].trim(),
      subset,
      weight: /font-weight:\s*([^;]+);/.exec(body)[1].trim(),
    });
  }
}

await mkdir(fontsDir, { recursive: true });
for (const f of faces) {
  await writeFile(path.join(fontsDir, f.file), f.body);
  console.log(`${f.file.padEnd(32)} ${(f.body.length / 1024).toFixed(1)} KB`);
}

// preserve whatever prose is at the top of fonts.css; only the @font-face
// rules below it are generated
const existing = existsSync(cssFile) ? readFileSync(cssFile, 'utf8') : '';
const header = existing.slice(0, Math.max(existing.indexOf('@font-face'), 0));

await writeFile(
  cssFile,
  header +
    faces
      .map(
        (f) => `@font-face {
  font-display: swap;
  font-family: '${f.family}';
  font-style: ${f.style};
  font-weight: ${f.weight};
  src: url('/fonts/${f.file}') format('woff2');
  unicode-range: ${f.range};
}`
      )
      .join('\n\n') +
    '\n'
);

const latin = faces
  .filter((f) => f.subset === 'latin')
  .reduce((s, f) => s + f.body.length, 0);
console.log(
  `\n${faces.length} files; a latin-only visitor downloads ${(latin / 1024).toFixed(1)} KB`
);
