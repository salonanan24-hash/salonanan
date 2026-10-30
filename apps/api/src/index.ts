import 'dotenv/config';
import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { isSupabaseConfigured } from './lib/supabase.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info('api listening', {
    port: config.port,
    supabaseConfigured: isSupabaseConfigured(),
    supabaseAnonPresent: config.supabaseAnonKey.length > 0,
    openaiConfigured: config.openaiApiKey.length > 0,
    resendConfigured: config.resendApiKey.length > 0,
  });
});

function shutdown(signal: string) {
  logger.info('shutdown requested', { signal });
  server.close((error) => {
    if (error) {
      logger.error('shutdown failed', { message: error.message });
      process.exit(1);
    }
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('shutdown timed out');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

server.on('error', (error: NodeJS.ErrnoException) => {
  logger.error('server error', { message: error.message, code: error.code });
  process.exit(1);
});
