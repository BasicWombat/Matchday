const router = require('express').Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../lib/auth');
const wrap = require('../lib/wrap');

const SAFE = 'id, username, display_name, role, created_at';

// GET /api/users — admin only
router.get('/', requireAdmin, wrap((req, res) => {
  res.json(db.prepare(`SELECT ${SAFE} FROM users ORDER BY id`).all());
}));

// POST /api/users — admin only
router.post('/', requireAdmin, wrap((req, res) => {
  const { username, display_name, password, role = 'member' } = req.body ?? {};
  if (!username?.trim() || !display_name?.trim() || !password)
    return res.status(400).json({ error: 'username, display_name, and password are required' });
  if (!['admin', 'member'].includes(role))
    return res.status(400).json({ error: 'role must be admin or member' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(username.trim(), display_name.trim(), hash, role);
    res.status(201).json(db.prepare(`SELECT ${SAFE} FROM users WHERE id = ?`).get(lastInsertRowid));
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
    throw e;
  }
}));

// PUT /api/users/:id — admin or own account
router.put('/:id', requireAuth, wrap((req, res) => {
  const targetId = Number(req.params.id);
  const isOwn = req.user.id === targetId;
  const isAdmin = req.user.role === 'admin';
  if (!isOwn && !isAdmin) return res.status(403).json({ error: 'You can only edit your own account' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { display_name, password, role } = req.body ?? {};
  if (role !== undefined && !isAdmin) return res.status(403).json({ error: 'Only admins can change roles' });
  if (role && !['admin', 'member'].includes(role)) return res.status(400).json({ error: 'role must be admin or member' });

  const newDisplayName = display_name?.trim() || user.display_name;
  const newRole = (isAdmin && role) ? role : user.role;
  const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

  db.prepare('UPDATE users SET display_name = ?, password_hash = ?, role = ? WHERE id = ?')
    .run(newDisplayName, newHash, newRole, targetId);

  res.json(db.prepare(`SELECT ${SAFE} FROM users WHERE id = ?`).get(targetId));
}));

// DELETE /api/users/:id — admin only, cannot delete self
router.delete('/:id', requireAdmin, wrap((req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ deleted: true, id: targetId });
}));

module.exports = router;
