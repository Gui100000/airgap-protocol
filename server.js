const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HTTP_PORT = 8080;
const HTTPS_PORT = 8443;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pfx': 'application/x-pkcs12'
};

function requestHandler(req, res) {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      });
      res.end(content);
    }
  });
}

// Find local Wi-Fi / Ethernet LAN IP
function getLanIps() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

const lanIps = getLanIps();

// 1. Start HTTP Server
const httpServer = http.createServer(requestHandler);
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🌐 AIRGAP PROTOCOL - LOCAL WEB SERVER ACTIVE`);
  console.log(`======================================================`);
  console.log(`💻 SU QUESTO PC:`);
  console.log(`   👉 http://localhost:${HTTP_PORT}/`);
  console.log(`   👉 http://127.0.0.1:${HTTP_PORT}/`);
  
  if (lanIps.length > 0) {
    console.log(`\n📱 DA SMARTPHONE O TABLET (Stessa rete Wi-Fi):`);
    lanIps.forEach(ip => {
      console.log(`   👉 http://${ip.address}:${HTTP_PORT}/   [${ip.name}]`);
    });
  }
});

// 2. Start HTTPS Server (with PFX certificate)
const pfxPath = path.join(PUBLIC_DIR, 'cert.pfx');
if (fs.existsSync(pfxPath)) {
  try {
    const pfx = fs.readFileSync(pfxPath);
    const httpsServer = https.createServer({ pfx, passphrase: 'airgap' }, requestHandler);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`\n🔒 HTTPS SERVER (Connessione Crittografata TLS):`);
      console.log(`   👉 https://localhost:${HTTPS_PORT}/`);
      if (lanIps.length > 0) {
        lanIps.forEach(ip => {
          console.log(`   👉 https://${ip.address}:${HTTPS_PORT}/   [${ip.name}]`);
        });
      }
      console.log(`======================================================\n`);
    });
  } catch (err) {
    console.warn('Could not start HTTPS server:', err.message);
  }
}
