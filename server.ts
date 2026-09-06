import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { apiRouter } from './server/api.js';
import { setupSocketServer } from './server/sockets.js';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  // Determine port or socket
  const rawPort = process.env.PORT;
  const PORT = rawPort && !isNaN(Number(rawPort))
    ? parseInt(rawPort, 10)
    : (rawPort || 3000);

  // Socket.IO server configured for high compatibility with reverse proxies (cPanel/Nginx/Apache/Passenger)
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
  });

  // Initialize Socket.IO handlers
  setupSocketServer(io);

  // App root resolution (supports standard Node, cPanel Passenger, Render, Docker)
  const ROOT_DIR = process.env.APP_ROOT || process.cwd();

  // Middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.use('/api/v1', apiRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'KOMECHAT', env: process.env.NODE_ENV || 'development' });
  });

  // Catch unmatched /api routes and return JSON 404 (NEVER fall through to Vite or SPA fallback HTML)
  app.all(['/api', '/api/*'], (req, res) => {
    res.status(404).json({ error: `Route API introuvable: ${req.method} ${req.path}` });
  });

  // Global API error handler (ensures JSON responses on errors instead of crashing or returning HTML)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    if (res.headersSent) {
      return next(err);
    }
    const statusCode = err.status || err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Le fichier dépasse la taille maximale autorisée (30 Mo).'
      : (err?.message || 'Erreur interne du serveur');
    res.status(statusCode).json({ error: message });
  });

  // Determine environment and dist folder resolution
  // If running as bundled server.cjs (in dist/), or on Railway/Render/Docker, or dist/index.html exists
  const isBundled = typeof __filename !== 'undefined' && (__filename.endsWith('.cjs') || __dirname.includes('dist'));
  const isCloudHost = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL || process.env.RENDER || process.env.FLY_ALLOC_ID || process.env.DYNO);

  // Look for dist/index.html in __dirname, ROOT_DIR/dist, or process.cwd()/dist
  const candidateDistPaths: string[] = [
    typeof __dirname !== 'undefined' ? __dirname : '',
    path.join(ROOT_DIR, 'dist'),
    path.join(process.cwd(), 'dist'),
  ].filter(Boolean);

  const resolvedDistPath = candidateDistPaths.find((p) => fs.existsSync(path.join(p, 'index.html'))) || path.join(ROOT_DIR, 'dist');
  const hasBuiltDist = fs.existsSync(path.join(resolvedDistPath, 'index.html'));

  const isProduction = process.env.NODE_ENV === 'production' || isBundled || isCloudHost || (hasBuiltDist && process.env.NODE_ENV !== 'development');

  if (!isProduction) {
    console.log('Starting in Development mode with Vite middleware...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log(`Starting in Production mode. Serving static files from ${resolvedDistPath}...`);

    // Serve static files from dist folder
    app.use(express.static(resolvedDistPath, {
      maxAge: '1d',
      index: false,
    }));

    // Missing assets under /assets or with extensions should return 404, not index.html
    app.use('/assets', (req, res) => {
      res.status(404).send('Asset not found');
    });

    // SPA fallback: Send index.html with no-cache headers for HTML navigations
    app.get('*', (req, res) => {
      // If request has a file extension (.js, .css, .ico, etc.) and was not caught by express.static, return 404
      if (path.extname(req.path)) {
        return res.status(404).send('File not found');
      }

      const indexPath = path.join(resolvedDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexPath);
      } else {
        res.status(500).send('KOMECHAT: Le dossier dist/ est introuvable. Veuillez exécuter "npm run build".');
      }
    });
  }

  // Handle cPanel Passenger unix socket or standard TCP port
  if (typeof PORT === 'number') {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`KOMECHAT Server running on port ${PORT}`);
    });
  } else {
    server.listen(PORT, () => {
      console.log(`KOMECHAT Server running on socket/port ${PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
