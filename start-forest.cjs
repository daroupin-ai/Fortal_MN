// 이 PC에서만 접속할 수 있는 숲 화면 실행 도구.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const page = path.join(__dirname, 'forest-light.html');
const server = http.createServer((request, response) => {
  if (request.url !== '/' && request.url !== '/forest-light.html') {
    response.writeHead(404); response.end(); return;
  }
  fs.readFile(page, (error, content) => {
    if (error) { response.writeHead(500); response.end('Could not read forest-light.html'); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Permissions-Policy': 'camera=(self), microphone=()' });
    response.end(content);
  });
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(4318, '127.0.0.1', () => console.log('Forest ready: http://127.0.0.1:4318'));
