import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiLimiter, sanitize } from './middleware/security.js';
import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import companyRoutes from './routes/company.routes.js';
import publicRoutes from './routes/public.routes.js';
import adminExtraRoutes from './routes/adminExtra.routes.js';
import seoRoutes from './routes/seo.routes.js';
import { webhooks } from './routes/payments.routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || env.clientOrigins.includes(origin)),
    credentials: true,
  }));
  // Webhooks need the raw body for signature verification, so they mount before the JSON parser.
  app.use('/api/v1/webhooks', webhooks);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(sanitize);
  if (env.nodeEnv !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'go-soft-api', time: new Date().toISOString() }));

  app.use('/api/v1', apiLimiter);
  app.use('/api/v1/public', publicRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/admin', adminExtraRoutes);
  app.use('/api/v1/company', companyRoutes);

  app.use('/', seoRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
