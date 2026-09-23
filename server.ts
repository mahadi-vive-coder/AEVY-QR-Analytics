import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { securityHeaders } from './server/middleware.js';
import { authRouter } from './server/routes/authRoutes.js';
import { qrRouter } from './server/routes/qrRoutes.js';
import { trackingRouter } from './server/routes/trackingRoutes.js';
import { analyticsRouter } from './server/routes/analyticsRoutes.js';
import { campaignRouter } from './server/routes/campaignRoutes.js';
import { visitorRouter } from './server/routes/visitorRoutes.js';
import { dataRouter } from './server/routes/dataRoutes.js';
import { settingsRouter } from './server/routes/settingsRoutes.js';
import { JsonDatabase, isBlobStorageConfigured } from './server/services/jsonDatabase.js';
import { seedInitialDataIfEmpty } from './server/services/seedService.js';
import { getResolvedAppUrl } from './server/services/urlService.js';
import { runMigrationIfNeeded } from './server/services/migrationService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

// Initialize JSON database
JsonDatabase.getInstance();

// Trigger migration if MIGRATION_MODE === 'true'
if (process.env.MIGRATION_MODE === 'true') {
  runMigrationIfNeeded()
    .then((res) => {
      console.log('[AEVY Migration]', res.message);
    })
    .catch((err) => {
      console.error('[AEVY Migration Error]:', err);
    });
} else if (!isBlobStorageConfigured()) {
  // Only seed demo data in local dev mode when no blob is configured
  seedInitialDataIfEmpty().catch(console.error);
}

// Standard middlewares
app.use(securityHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Trust proxy for proper IP resolution behind reverse proxies / Vercel Edge
app.set('trust proxy', 1);

// Mount dynamic QR tracking redirect & lead submission FIRST for peak speed
app.use(trackingRouter);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/qrcodes', qrRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/visitors', visitorRouter);
app.use('/api/data', dataRouter);
app.use('/api/settings', settingsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', brand: 'AEVY', time: new Date().toISOString() });
});

// Standalone server lifecycle for local development and non-Vercel environments
async function startServer() {
  if (!isProduction) {
    // Development mode: Mount Vite dev server middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production standalone mode: Serve built frontend assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`[AEVY QR Analytics] Server running on port ${PORT} (isProduction=${isProduction})`);
    try {
      const resolved = await getResolvedAppUrl();
      console.log(`[AEVY QR Analytics] Active Production QR Tracking URL Base: ${resolved.baseUrl} (Source: ${resolved.source})`);
      if (resolved.isDevWarning && resolved.errorMessage) {
        console.warn(`[AEVY QR Analytics] WARNING: ${resolved.errorMessage}`);
      }
    } catch (err: any) {
      console.error('[AEVY QR Analytics] Error resolving APP_URL:', err.message);
    }
  });
}

// Do NOT call app.listen() when running on Vercel serverless environment
if (!isVercel) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default app;
