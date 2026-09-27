const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8085;
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '/seeded-test-page.html') {
    reqPath = '/seeded-test-page.html';
  }
  const filePath = path.join(FIXTURES_DIR, reqPath.replace(/^\//, ''));

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
    };
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'text/plain',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local static fixture server running at http://127.0.0.1:${PORT}/seeded-test-page.html`);
});
