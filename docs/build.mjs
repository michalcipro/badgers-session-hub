/**
 * Wraps session-hub.html (which is authored as a Claude Artifact page body)
 * into a complete standalone HTML document at index.html, which is what
 * GitHub Pages serves.
 *
 *   node build.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const SRC = join(HERE, 'session-hub.html');
const OUT = join(HERE, 'index.html');
const SPLIT = '<div class="demo">';

const src = readFileSync(SRC, 'utf8');
const i = src.indexOf(SPLIT);
if (i === -1) throw new Error(`Cannot find "${SPLIT}" in ${SRC} — the split point moved.`);

const head = src.slice(0, i).trim();   // <title>, font <link>s, the page <style>
const body = src.slice(i).trim();      // markup + <script>

writeFileSync(OUT, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Prototype of the scheduling and messaging platform between Winning Minds and Wisconsin Badgers women's tennis.">
<style>
/* Baseline the Claude Artifact runtime normally supplies. Must stay above the page's own styles. */
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
</style>
${head}
</head>
<body>
${body}
</body>
</html>
`);

console.log(`${OUT} written — ${(readFileSync(OUT).length / 1024).toFixed(1)} KB`);
