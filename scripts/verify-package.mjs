import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { gzipSync } from 'node:zlib';
const repo = process.cwd();
const npm = process.env.npm_execpath;
assert(npm, 'Run this check through npm run test:package');
const scratch = await mkdtemp(join(tmpdir(), 'scrollable-package-'));
const run = (args, cwd) =>
  execFileSync(process.execPath, [npm, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
try {
  const source = join(scratch, 'source');
  await mkdir(source);
  for (const name of [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'src',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
  ])
    await cp(join(repo, name), join(source, name), { recursive: true });
  await mkdir(join(source, 'scripts'));
  await cp(join(repo, 'scripts/build.mjs'), join(source, 'scripts/build.mjs'));
  run(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], source);
  const packed = JSON.parse(run(['pack', '--json'], source))[0];
  const files = packed.files.map((file) => file.path);
  for (const required of [
    'dist/index.js',
    'dist/style.css',
    'dist/index.d.ts',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
  ])
    assert(files.includes(required), required + ' must ship');
  assert(
    files.every(
      (file) =>
        file.startsWith('dist/') ||
        ['package.json', 'README.md', 'LICENSE', 'CHANGELOG.md'].includes(file),
    ),
    'Only distribution and public documentation may ship',
  );
  const manifest = JSON.parse(
    await readFile(join(source, 'package.json'), 'utf8'),
  );
  assert.equal(
    Object.keys(manifest.dependencies || {}).length,
    0,
    'No runtime dependencies',
  );
  async function verifyExports(value) {
    if (typeof value === 'string') await readFile(join(source, value));
    else for (const child of Object.values(value)) await verifyExports(child);
  }
  await verifyExports(manifest.exports);
  const sizes = {};
  for (const [file, limit] of [
    ['index.js', 10240],
    ['style.css', 3072],
  ]) {
    sizes[file] = gzipSync(await readFile(join(source, 'dist', file))).length;
    assert(sizes[file] <= limit, file + ' exceeds gzip budget');
  }
  const consumer = join(scratch, 'consumer');
  await mkdir(consumer);
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  run(
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      join(source, packed.filename),
      'react@' + manifest.devDependencies.react,
      'react-dom@' + manifest.devDependencies['react-dom'],
    ],
    consumer,
  );
  await writeFile(
    join(consumer, 'verify.mjs'),
    "import assert from 'node:assert/strict'; import Scrollable from '@mesihtasci/scrollable'; assert.equal(typeof window,'undefined'); assert.equal(typeof document,'undefined'); assert.equal(typeof Scrollable,'function'); console.log(import.meta.resolve('@mesihtasci/scrollable/style.css'));",
  );
  execFileSync(process.execPath, ['verify.mjs'], {
    cwd: consumer,
    stdio: 'inherit',
  });
  await writeFile(
    join(consumer, 'consumer.ts'),
    "import Scrollable, {type ScrollableOptions,type ScrollableChangeDetail} from '@mesihtasci/scrollable'; const options: ScrollableOptions={duration:0,hash:'push'}; const s=new Scrollable(document.body,options); const result: Promise<boolean>=s.goTo('section'); const index:number=s.currentIndex; const detail:ScrollableChangeDetail={fromIndex:0,toIndex:1,direction:'down',source:'api'}; void result; void index; void detail; s.refresh(); s.destroy();\n// @ts-expect-error private implementation state is not public\ns.index;\n// @ts-expect-error invalid input type\ns.goTo(null);",
  );
  for (const [module, resolution] of [
    ['NodeNext', 'NodeNext'],
    ['ESNext', 'Bundler'],
  ]) {
    execFileSync(
      process.execPath,
      [
        join(repo, 'node_modules/typescript/bin/tsc'),
        'consumer.ts',
        '--noEmit',
        '--strict',
        '--skipLibCheck',
        'false',
        '--target',
        'ES2022',
        '--module',
        module,
        '--moduleResolution',
        resolution,
        '--lib',
        'ES2022,DOM,DOM.Iterable',
      ],
      { cwd: consumer, stdio: 'inherit' },
    );
  }
  await writeFile(
    join(consumer, 'vanilla.js'),
    "import Scrollable from '@mesihtasci/scrollable'; import '@mesihtasci/scrollable/style.css'; new Scrollable('.mt-vs');",
  );
  await writeFile(
    join(consumer, 'main.tsx'),
    "import React from 'react'; import {createRoot} from 'react-dom/client'; import Scrollable from '@mesihtasci/scrollable'; import '@mesihtasci/scrollable/style.css'; function App(){const ref=React.useRef<HTMLDivElement>(null);React.useEffect(()=>{const instance=new Scrollable(ref.current!);return()=>instance.destroy()},[]);return <div ref={ref} className='mt-vs'><main className='mt-vs__container'><section className='mt-vs__content'>Hello</section></main></div>}createRoot(document.getElementById('app')!).render(<App/>);",
  );
  for (const entry of ['vanilla.js', 'main.tsx']) {
    await writeFile(
      join(consumer, 'index.html'),
      '<div id="app"></div><script type="module" src="./' +
        entry +
        '"></script>',
    );
    execFileSync(
      process.execPath,
      [join(repo, 'node_modules/vite/bin/vite.js'), 'build'],
      { cwd: consumer, stdio: 'inherit' },
    );
  }
  console.log(
    JSON.stringify(
      {
        package: packed.id,
        files: files.length,
        gzipBytes: sizes,
        checks:
          'clean prepack, exports, SSR import, NodeNext/Bundler declarations, vanilla/React builds passed',
      },
      null,
      2,
    ),
  );
} finally {
  assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
  assert(basename(scratch).startsWith('scrollable-package-'));
  await rm(scratch, { recursive: true, force: true });
}
