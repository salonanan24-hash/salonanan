type LogMeta = Record<string, unknown>;

function write(level: 'info' | 'warn' | 'error', message: string, meta?: LogMeta) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...meta,
  });

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    write('info', message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    write('warn', message, meta);
  },
  error(message: string, meta?: LogMeta) {
    write('error', message, meta);
  },
};
