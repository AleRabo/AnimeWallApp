import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standaloneRoot = path.join(projectRoot, '.next', 'standalone');
const updaterRoot = path.join(projectRoot, 'electron', 'vendor', 'node_modules');
const updaterPackages = [
  'electron-updater',
  'builder-util-runtime',
  'fs-extra',
  'js-yaml',
  'lazy-val',
  'lodash.escaperegexp',
  'lodash.isequal',
  'semver',
  'tiny-typed-emitter',
  'debug',
  'sax'
];

await rm(path.join(standaloneRoot, '.next', 'static'), { recursive: true, force: true });
await rm(path.join(standaloneRoot, 'public'), { recursive: true, force: true });
await mkdir(path.join(standaloneRoot, '.next'), { recursive: true });
await cp(
  path.join(projectRoot, '.next', 'static'),
  path.join(standaloneRoot, '.next', 'static'),
  { recursive: true }
);
await cp(
  path.join(projectRoot, 'public'),
  path.join(standaloneRoot, 'public'),
  { recursive: true }
);
await rm(path.join(standaloneRoot, 'runtime_modules'), { recursive: true, force: true });
await cp(
  path.join(standaloneRoot, 'node_modules'),
  path.join(standaloneRoot, 'runtime_modules'),
  { recursive: true }
);
await rm(path.join(standaloneRoot, 'node_modules'), { recursive: true, force: true });

await rm(updaterRoot, { recursive: true, force: true });
await mkdir(updaterRoot, { recursive: true });
for (const packageName of updaterPackages) {
  await cp(
    path.join(projectRoot, 'node_modules', packageName),
    path.join(updaterRoot, packageName),
    { recursive: true }
  );
}
