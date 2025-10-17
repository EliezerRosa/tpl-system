import { createServer } from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const PORT = 4173;
const HOST = '127.0.0.1';
const BASE_PREFIX = '/tpl-system/';
const DOCS_DIR = path.resolve('docs');

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
]);

function resolveAssetPath(urlPath) {
  if (urlPath === '/' || urlPath === '') {
    return { type: 'redirect' };
  }

  if (urlPath.startsWith(BASE_PREFIX)) {
    const slice = urlPath.slice(BASE_PREFIX.length);
    const relative = slice === '' || slice === '/' ? 'index.html' : slice.replace(/^\/+/, '');
    return { type: 'file', filePath: path.join(DOCS_DIR, relative) };
  }

  const fallback = urlPath.replace(/^\/+/, '');
  const target = fallback === '' ? 'index.html' : fallback;
  return { type: 'file', filePath: path.join(DOCS_DIR, target) };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);
  const decision = resolveAssetPath(url.pathname);

  if (decision.type === 'redirect') {
    response.writeHead(302, { Location: BASE_PREFIX });
    response.end();
    return;
  }

  try {
    const data = await fs.readFile(decision.filePath);
    const extension = path.extname(decision.filePath);
    const contentType = mimeTypes.get(extension) ?? 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(data);
  } catch (error) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
  }
});

await new Promise((resolve) => server.listen(PORT, HOST, resolve));

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`http://${HOST}:${PORT}${BASE_PREFIX}`, { waitUntil: 'networkidle' });

const modalCount = await page.locator('text=Configurar Personal Access Token').count();
const storedToken = await page.evaluate(() => localStorage.getItem('territoryAppPat'));

console.log(JSON.stringify({ modalCount, storedToken }, null, 2));

await browser.close();
server.close();
