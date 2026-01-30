// clean-build.js
// Script to clean Next.js build artifacts and force service worker cache clear

const fs = require('fs');
const path = require('path');

function rmrf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`Deleted: ${target}`);
  }
}

// Clean .next and public/_next
rmrf(path.join(__dirname, '.next'));
rmrf(path.join(__dirname, 'public', '_next'));

// Write a force cache clear script for service worker
const swCacheClear = `if ('caches' in self) { caches.keys().then(keys => keys.forEach(key => caches.delete(key))); }`;
fs.writeFileSync(path.join(__dirname, 'public', 'force-sw-cache-clear.js'), swCacheClear);
console.log('Created public/force-sw-cache-clear.js for service worker cache clearing.');
