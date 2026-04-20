import ghpages from 'gh-pages';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a short cache directory in the user's home folder to avoid Windows path length limits
const cacheDir = path.join(os.homedir(), '.ghp-cache');
process.env.CACHE_DIR = cacheDir;

console.log(`Deploying to GitHub Pages...`);
console.log(`Cache directory (via CACHE_DIR env): ${cacheDir}`);

ghpages.publish('dist', {
  dest: '.', // Deploy to the root of the branch
  dotfiles: true
}, function(err) {
  if (err) {
    console.error('Deployment failed:', err);
    process.exit(1);
  } else {
    console.log('Deployment successful!');
  }
});
