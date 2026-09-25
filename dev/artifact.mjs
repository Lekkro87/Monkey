// Turns the single-file build into a page body for publishing as a claude.ai Artifact.
// The platform wraps pages in its own <!doctype html><head><body> skeleton, so the output
// carries only the title, the font stylesheet, the styles, the markup and the script.
// Usage: npm run build:single && node dev/artifact.mjs [dist-single/index.html] [out.html]
import fs from 'node:fs';

const [src = 'dist-single/index.html', out = 'dist-single/storage-hunter.html'] = process.argv.slice(2);
const html = fs.readFileSync(src, 'utf8');

const between = (open, close, from = 0) => {
  const a = html.indexOf(open, from);
  const b = html.indexOf(close, a);
  if (a < 0 || b < 0) throw new Error(`missing ${open}…${close}`);
  return { start: a, end: b + close.length, inner: html.slice(html.indexOf('>', a) + 1, b) };
};

const head = between('<head>', '</head>');
const body = between('<body>', '</body>');
const headHtml = html.slice(head.start, head.end);
const title = headHtml.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? '<title>Storage Hunter</title>';
const fonts = headHtml.match(/<link rel="(?:preconnect|stylesheet)"[^>]*>/gi) ?? [];
const script = between('<script', '</script>');
const style = between('<style', '</style>');

const page = [
  title,
  ...fonts,
  `<style>${style.inner}</style>`,
  body.inner.trim(),
  `<script type="module">${script.inner}</script>`,
  '',
].join('\n');

fs.writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024).toFixed(0)} KiB`);
