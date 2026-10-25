import type { RequestHandler } from 'express';
import { logger } from '../lib/logger.js';

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = Date.now();

  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - started,
    });
  });

  next();
};
