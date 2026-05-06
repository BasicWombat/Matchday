const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'matchday-dev-secret';
const EXPIRES = '7d';

const sign = (payload) => jwt.sign(payload, SECRET, { expiresIn: EXPIRES });

const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Login required' });
  try {
    req.user = jwt.verify(auth.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
};

const requireAdmin = [
  requireAuth,
  (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  },
];

module.exports = { sign, requireAuth, requireAdmin };
