// Build script to create browser bundle of mediasoup-client
const browserify = require('browserify');
const fs = require('fs');
const path = require('path');

console.log('📦 Building mediasoup-client browser bundle...');

const b = browserify({
  entries: [path.join(__dirname, 'node_modules', 'mediasoup-client', 'lib', 'index.js')],
  standalone: 'mediasoup',
  debug: false
});

b.bundle()
  .pipe(fs.createWriteStream(path.join(__dirname, 'public', 'mediasoup-client-bundle.js')))
  .on('finish', () => {
    console.log('✅ mediasoup-client bundle created at public/mediasoup-client-bundle.js');
  })
  .on('error', (err) => {
    console.error('❌ Error building bundle:', err);
    process.exit(1);
  });

