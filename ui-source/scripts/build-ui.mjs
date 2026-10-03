import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const result = await build({
  entryPoints: [resolve(root, 'src/ui/index.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  outfile: resolve(root, 'dist/ui/widget.js'),
  write: false,
  minify: true,
  sourcemap: false,
});

const script = result.outputFiles.find((file) => file.path.endsWith('.js'))?.text;
if (!script) throw new Error('The UI bundle did not contain JavaScript.');
const style = await readFile(resolve(root, 'src/ui/widget.css'), 'utf8');
const inlineScript = script.replaceAll('</script', '<\\/script');
const inlineStyle = style.replaceAll('</style', '<\\/style');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>UCE Evidence Lens</title>
  <style>${inlineStyle}</style>
</head>
<body>
  <div id="app"></div>
  <script>${inlineScript}</script>
</body>
</html>`;

const destination = resolve(root, 'dist/ui/widget.html');
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, html, 'utf8');
console.log(`Built ${destination}`);
