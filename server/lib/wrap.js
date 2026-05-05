// Wraps a sync better-sqlite3 route handler so thrown errors reach Express's error handler
module.exports = fn => (req, res, next) => {
  try { fn(req, res, next); } catch (e) { next(e); }
};
