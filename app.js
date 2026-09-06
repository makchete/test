// app.js - Point d'entrée pour serveurs et hébergeurs (cPanel / Passenger / Railway / Docker)
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.APP_ROOT = __dirname;
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const bundledFile = path.join(__dirname, 'dist', 'server.cjs');

if (fs.existsSync(bundledFile)) {
  await import(`file://${bundledFile}`);
} else {
  // Fallback immédiat si dist/ n'a pas encore été compilé
  const port = process.env.PORT || 3000;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>KOMECHAT Server en ligne</h1><p>En attente de compilation du dossier dist/. Veuillez exécuter "npm run build".</p>');
  });
  const portNum = Number(port);
  if (!isNaN(portNum)) {
    server.listen(portNum, '0.0.0.0', () => {
      console.log(`Fallback server running on port ${portNum}`);
    });
  } else {
    server.listen(port);
  }
}
