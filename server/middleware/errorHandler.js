'use strict';

/**
 * Global error handler middleware.
 * Must be registered LAST with app.use().
 * Catches any error thrown or passed via next(err) in routes.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR ${req.method} ${req.path}:`, err.message);

  const isDev = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    error:   err.message || 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = errorHandler;
