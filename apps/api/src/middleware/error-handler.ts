import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { config } from '../config.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../lib/logger.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Validation failed',
        details: error.flatten(),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    const body: {
      error: { code: string; message: string; details?: unknown };
    } = {
      error: {
        code: error.code,
        message: error.message,
      },
    };

    if (error.details !== undefined) {
      body.error.details = error.details;
    }

    res.status(error.status).json(body);
    return;
  }

  logger.error('unhandled error', {
    message: error instanceof Error ? error.message : 'unknown error',
  });

  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Internal server error',
      ...(config.nodeEnv === 'development' && error instanceof Error
        ? { details: error.message }
        : {}),
    },
  });
};
