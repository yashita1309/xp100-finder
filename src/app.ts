import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import stationRoutes from './routes/stationRoutes';
import adminRoutes from './routes/adminRoutes';
import hpclStationRoutes from './hpcl/routes/stationRoutes';
import hpclAdminRoutes from './hpcl/routes/adminRoutes';
import shellStationRoutes from './shell/routes/stationRoutes';
import shellAdminRoutes from './shell/routes/adminRoutes';
import bpclStationRoutes from './bpcl/routes/stationRoutes';
import bpclAdminRoutes from './bpcl/routes/adminRoutes';
import ioclXp95Routes from './routes/ioclXp95Routes';
import { errorHandler } from './middleware/errorHandler';

import path from 'path';
import fs from 'fs';

const app: Express = express();

// Standard middleware
app.use(cors());
app.use(express.json());

// GET /health - basic system check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Register routers
app.use('/stations', stationRoutes);
app.use('/admin', adminRoutes);
app.use('/hpcl/stations', hpclStationRoutes);
app.use('/hpcl/admin', hpclAdminRoutes);
app.use('/shell/stations', shellStationRoutes);
app.use('/shell/admin', shellAdminRoutes);
app.use('/bpcl/stations', bpclStationRoutes);
app.use('/bpcl/admin', bpclAdminRoutes);
app.use('/iocl/xp95', ioclXp95Routes);

// Fallback 404 for API routes specifically
app.use(['/stations', '/admin', '/hpcl', '/shell', '/bpcl', '/iocl'], (_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested API route or method is not defined.',
  });
});

const staticPath = path.resolve('dist/public');
const indexPath = path.join(staticPath, 'index.html');

if (fs.existsSync(indexPath)) {
  console.log('[Server] Static frontend found at dist/public. Mounting frontend router.');
  // Serve frontend static assets from dist/public folder
  app.use(express.static(staticPath));
  // Fallback to index.html for SPA client-side routing
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(indexPath);
  });
} else {
  console.log('[Server] Static frontend not found. Operating in API-only mode.');
  // Friendly API welcome message at root
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      message: 'Premium Petrol Finder API Server is running.',
      version: '1.0.0',
    });
  });
  // Default API-style 404 for other pages
  app.get('*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'API endpoint not found.',
    });
  });
}

// Global central error handler middleware
app.use(errorHandler);

export default app;
