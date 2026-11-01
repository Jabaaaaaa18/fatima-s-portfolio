import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.glb', 'model/gltf-binary'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

function respond(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(message);
}

function streamFile(filePath, res, range) {
  const stream = range ? createReadStream(filePath, range) : createReadStream(filePath);
  stream.on('error', (error) => {
    console.error(`Could not stream ${filePath}:`, error);
    if (!res.headersSent) respond(res, 500, 'Internal server error');
    else res.destroy();
  });
  stream.pipe(res);
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    respond(res, 405, 'Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    respond(res, 400, 'Invalid URL');
    return;
  }

  const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
  const filePath = join(root, requestedPath);
  const relativePath = relative(root, filePath);
  if (relativePath.startsWith(`..${sep}`) || relativePath === '..' || isAbsolute(relativePath)) {
    respond(res, 403, 'Forbidden');
    return;
  }

  let fileInfo;
  try {
    fileInfo = await stat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      respond(res, 404, 'Not found');
      return;
    }
    console.error(`Could not read ${filePath}:`, error);
    respond(res, 500, 'Internal server error');
    return;
  }

  if (!fileInfo.isFile()) {
    respond(res, 404, 'Not found');
    return;
  }

  const headers = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    'Content-Length': fileInfo.size,
    'Content-Type': mimeTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  };
  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : Math.max(0, fileInfo.size - Number(match[2]));
      const end = match[2] && match[1] ? Math.min(Number(match[2]), fileInfo.size - 1) : fileInfo.size - 1;
      if (start > end || start >= fileInfo.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        res.writeHead(416, { 'Content-Range': `bytes */${fileInfo.size}` });
        res.end();
        return;
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${fileInfo.size}`;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      if (req.method === 'HEAD') res.end();
      else streamFile(filePath, res, { start, end });
      return;
    }
  }

  res.writeHead(200, headers);
  if (req.method === 'HEAD') res.end();
  else streamFile(filePath, res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Portfolio available at http://127.0.0.1:${port}`);
});

server.on('error', (error) => {
  console.error('Portfolio server failed:', error);
  process.exitCode = 1;
});
