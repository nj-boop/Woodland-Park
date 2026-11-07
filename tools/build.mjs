// Builds the single-page game from src/ into dist/.
//   node tools/build.mjs          -> dist/index.html (+ dist/models/*.json)
//   node tools/build.mjs --test   -> dist/test.html with a test hook exposed as window.__wg
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');
const test = process.argv.includes('--test');

const manifest = JSON.parse(src('manifest.json'));
const files = test ? [...manifest.slice(0, -1), 'core/testhook.js', manifest.at(-1)] : manifest;
const js = files.map((f) => `// ===== ${f} =====\n${src(f)}`).join('\n');

const html = [
  src('ui/head.html'),
  `<style>\n${src('ui/styles.css')}</style>`,
  src('ui/layout.html'),
  src('ui/libs.html'),
  `<script>\n(() => {\n${js}\n})();\n</script>`,
].join('\n');

mkdirSync(join(root, 'dist', 'models'), { recursive: true });
writeFileSync(join(root, 'dist', test ? 'test.html' : 'index.html'), html);
for (const f of readdirSync(join(root, 'assets', 'models')))
  if (f.endsWith('.json')) copyFileSync(join(root, 'assets', 'models', f), join(root, 'dist', 'models', f));
console.log(
  `built dist/${test ? 'test' : 'index'}.html from ${files.length} files (${(html.length / 1024).toFixed(0)} KB)`
);
