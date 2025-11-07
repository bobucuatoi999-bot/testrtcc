/**
 * Simple structured logger
 */
function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  console.log(JSON.stringify(logEntry));
}

const logger = {
  info: (message, meta) => log('INFO', message, meta),
  warn: (message, meta) => log('WARN', message, meta),
  error: (message, meta) => log('ERROR', message, meta),
  debug: (message, meta) => {
    if (process.env.NODE_ENV === 'development') {
      log('DEBUG', message, meta);
    }
  }
};

module.exports = logger;

