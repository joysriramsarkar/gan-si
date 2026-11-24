function notFound(req, res) {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}]`, req.method, req.path, '-', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.expose === false && status === 500 ? 'Internal error' : (err.message || 'Internal error'), code: err.code || 'INTERNAL' });
}

module.exports = { notFound, errorHandler };
