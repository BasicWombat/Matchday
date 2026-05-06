const router = require('express').Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { sign, requireAuth } = require('../lib/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password)
    return res.status(400).json({ error: 'username and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid username or password' });

  const { password_hash, ...userData } = user;
  res.json({ token: sign(userData), user: userData });
});

// POST /api/auth/logout — client clears the token; this endpoint is a no-op
router.post('/logout', (req, res) => res.json({ ok: true }));

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, username, display_name, role, my_team_id, created_at FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = router;
