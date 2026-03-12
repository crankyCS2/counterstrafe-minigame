import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function normalizeBasePath(value, fallback) {
  const raw = (value || fallback || '').trim();
  if (!raw) throw new Error('Base path cannot be empty.');
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  const withTrailing = withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  return withTrailing;
}

function baseToFolder(basePath) {
  return basePath.replace(/^\//, '').replace(/\/$/, '');
}

function runOrFail(cmd, args, env) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

const mainBase = normalizeBasePath(process.env.MAIN_BASE_PATH, '/counterstrafe-minigame/');
const featureBase = normalizeBasePath(process.env.FEATURE_BASE_PATH, '/new-feature/');

if (mainBase === featureBase) {
  throw new Error(`MAIN_BASE_PATH and FEATURE_BASE_PATH must differ. Both were ${mainBase}`);
}

const distRoot = path.resolve('dist-pages');
const mainFolder = baseToFolder(mainBase);
const featureFolder = baseToFolder(featureBase);
const mainOutDir = path.join(distRoot, mainFolder);
const featureOutDir = path.join(distRoot, featureFolder);

rmSync(distRoot, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });

runOrFail('npm', ['run', 'build', '--', '--outDir', mainOutDir], { BASE_PATH: mainBase });
runOrFail('npm', ['run', 'build', '--', '--outDir', featureOutDir], { BASE_PATH: featureBase });

const landingHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Counterstrafe Minigame Deployments</title>
    <style>
      body { font-family: Inter, system-ui, -apple-system, sans-serif; margin: 2rem; line-height: 1.5; }
      h1 { margin-bottom: 0.5rem; }
      ul { padding-left: 1.25rem; }
      a { font-weight: 600; }
      code { background: #f5f5f5; padding: 0.1rem 0.35rem; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>Counterstrafe Minigame Deployments</h1>
    <p>Choose which deployed variant you want to open:</p>
    <ul>
      <li><a href="${mainBase}">Main deployment</a> <code>${mainBase}</code></li>
      <li><a href="${featureBase}">New feature deployment</a> <code>${featureBase}</code></li>
    </ul>
  </body>
</html>
`;

writeFileSync(path.join(distRoot, 'index.html'), landingHtml, 'utf8');

console.log(`\nBuilt GitHub Pages bundle at ${distRoot}`);
console.log(`- Main deployment: ${mainBase}`);
console.log(`- Feature deployment: ${featureBase}`);
