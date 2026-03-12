import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const ghpages = require('gh-pages');

function detectRepo() {
  const envRepo = (process.env.GH_PAGES_REPO || '').trim();
  if (envRepo) return envRepo;

  try {
    const origin = execSync('git config --get remote.origin.url', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    }).trim();
    if (origin) return origin;
  } catch {
    // noop
  }

  throw new Error(
    'No publish remote found. Set GH_PAGES_REPO (for example: https://github.com/<user>/<repo>.git) or configure git remote.origin.url.'
  );
}

const repo = detectRepo();

await new Promise((resolve, reject) => {
  ghpages.publish(
    'dist-pages',
    {
      repo,
      dotfiles: true,
      message: 'Deploy main + feature Pages variants'
    },
    (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    }
  );
});

console.log(`Published dist-pages to ${repo}`);
