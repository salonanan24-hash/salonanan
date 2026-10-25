import cors from 'cors';
import express from 'express';
import { isCorsOrigin } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestLogger } from './middleware/request-logger.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(express.json({ limit: '8mb' }));
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isCorsOrigin(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
