const http = require('http');
const fs = require('fs');
const path = require('path');

const host = '127.0.0.1';
const port = Number(process.env.PORT) || 8080;
const rootDir = __dirname;

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav'
};

function resolvePath(requestUrl) {
    const pathname = decodeURIComponent((requestUrl || '/').split('?')[0]);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const absolutePath = path.normalize(path.join(rootDir, relativePath));

    if (!absolutePath.startsWith(rootDir)) {
        return null;
    }

    return absolutePath;
}

http.createServer((req, res) => {
    const filePath = resolvePath(req.url);

    if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': mimeTypes[extension] || 'application/octet-stream'
        });
        res.end(data);
    });
}).listen(port, host, () => {
    console.log(`Drum Editor available at http://${host}:${port}`);
});
