const https = require('https');
const fs = require('fs');
const path = require('path');

const FFMPEG_CORE_VERSION = '0.12.4';
const FFMPEG_CORE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/ffmpeg-core.js`;
const FFMPEG_CORE_WASM_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/ffmpeg-core.wasm`;

const publicDir = path.join(__dirname, '../public/ffmpeg');

// Create the ffmpeg directory if it doesn't exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(publicDir, filename));
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      fs.unlink(path.join(publicDir, filename), () => reject(err));
    });
  });
}

async function downloadFFmpegFiles() {
  try {
    console.log('Downloading FFmpeg core files...');
    await Promise.all([
      downloadFile(FFMPEG_CORE_URL, 'ffmpeg-core.js'),
      downloadFile(FFMPEG_CORE_WASM_URL, 'ffmpeg-core.wasm')
    ]);
    console.log('FFmpeg core files downloaded successfully!');
  } catch (error) {
    console.error('Error downloading FFmpeg core files:', error);
    process.exit(1);
  }
}

downloadFFmpegFiles(); 