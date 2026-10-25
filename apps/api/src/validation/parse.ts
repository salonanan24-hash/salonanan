import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

export function parseWithSchema<T>(schema: ZodType<T>, data: unknown, source: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, 'validation_error', `Invalid ${source}`, result.error.flatten());
  }

  return result.data;
}
