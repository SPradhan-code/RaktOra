// Central Error Handler Middleware for Express

function errorHandler(err, req, res, next) {
  // Always log complete error details on the server side for diagnostics
  console.error('[API ERROR]:', err);

  // Correctly evaluate HTTP status code from custom error or response
  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  
  // Sanitize internal database / raw system error messages sent to clients in production
  let clientMessage = err.message || 'Internal Server Error';
  if (err.code && (err.code.startsWith('ER_') || err.code.startsWith('PROTOCOL_'))) {
    if (process.env.NODE_ENV === 'production') {
      clientMessage = 'A database error occurred. Please check your request parameters and try again.';
    } else {
      clientMessage = `Database Error (${err.code}): ${err.message}`;
    }
  }

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack, code: err.code })
  });
}

function notFound(req, res, next) {
  const error = new Error(`Route Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
}

module.exports = {
  errorHandler,
  notFound
};
