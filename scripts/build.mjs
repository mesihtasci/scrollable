import { build } from 'esbuild';
import { rm, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
if (relative(root, output) !== 'dist' || relative(root, process.cwd()) !== '') {
  throw new Error(
    'Build must run from the repository root and may only clean its dist directory.',
  );
}
await rm(output, { recursive: true, force: true });
await mkdir(output);
await build({
  entryPoints: { index: 'src/index.ts', style: 'src/styles.css' },
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: true,
});
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '--emitDeclarationOnly'],
  { stdio: 'inherit' },
);
