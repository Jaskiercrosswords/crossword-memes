/*
 * Мини-сервер для локального запуска игры (без зависимостей).
 * Запуск: multitool-node tools/serve.cjs [папка] [порт]
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || process.cwd());
const port = Number(process.argv[3] || 8123);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer(function (request, response) {
  let pathname = '/';
  try {
    pathname = decodeURIComponent((request.url || '/').split('?')[0]);
  } catch (error) {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(root, pathname);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, function (error, data) {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Не найдено: ' + pathname);
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(data);
  });
});

server.listen(port, '127.0.0.1', function () {
  console.log('http://localhost:' + port);
});

server.on('error', function (error) {
  console.error('Не удалось запустить сервер:', error.message);
  process.exit(1);
});
