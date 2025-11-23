export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message,
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
    });
  }

  if (err.name === 'MongoError' && err.code === 11000) {
    return res.status(400).json({
      error: 'Duplicate entry',
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
};