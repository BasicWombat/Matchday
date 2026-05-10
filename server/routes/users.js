const router = require('express').Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../lib/auth');
const wrap = require('../lib/wrap');

const SAFE = 'id, username, display_name, email, role, created_at';

// GET /api/users — admin only
router.get('/', requireAdmin, wrap((req, res) => {
  res.json(db.prepare(`SELECT ${SAFE} FROM users ORDER BY id`).all());
}));

// GET /api/users/:id — admin or own account only
router.get('/:id', requireAuth, wrap((req, res) => {
  const targetId = Number(req.params.id);
  const isOwn  = req.user.id === targetId;
  const isAdmin = req.user.role === 'admin';
  if (!isOwn && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const user = db.prepare(`SELECT ${SAFE} FROM users WHERE id = ?`).get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));

// POST /api/users — admin only
router.post('/', requireAdmin, wrap((req, res) => {
  const { username, display_name, email, password, role = 'member' } = req.body ?? {};
  if (!username?.trim() || !display_name?.trim() || !password)
    return res.status(400).json({ error: 'username, display_name, and password are required' });
  if (!['admin', 'member'].includes(role))
    return res.status(400).json({ error: 'role must be admin or member' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (username, display_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(username.trim(), display_name.trim(), email?.trim() || null, hash, role);
    res.status(201).json(db.prepare(`SELECT ${SAFE} FROM users WHERE id = ?`).get(lastInsertRowid));
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
    throw e;
  }
}));

// PUT /api/users/:id — admin or own account
router.put('/:id', requireAuth, wrap((req, res) => {
  const targetId = Number(req.params.id);
  const isOwn  = req.user.id === targetId;
  const isAdmin = req.user.role === 'admin';
  if (!isOwn && !isAdmin) return res.status(403).json({ error: 'You can only edit your own account' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { display_name, username, email, password, current_password, role } = req.body ?? {};
  if (role !== undefined && !isAdmin) return res.status(403).json({ error: 'Only admins can change roles' });
  if (role && !['admin', 'member'].includes(role)) return res.status(400).json({ error: 'role must be admin or member' });

  // Non-admin editing their own password must supply current_password
  if (password && isOwn && !isAdmin) {
    if (!current_password)
      return res.status(400).json({ error: 'Current password is required to change your password' });
    if (!bcrypt.compareSync(current_password, user.password_hash))
      return res.status(400).json({ error: 'Current password is incorrect' });
  }

  // Check username uniqueness if changed
  const newUsername = username?.trim() || user.username;
  if (newUsername !== user.username) {
    const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, targetId);
    if (taken) return res.status(400).json({ error: 'Username already taken' });
  }

  const newDisplayName = display_name?.trim() || user.display_name;
  const newEmail       = email !== undefined ? (email?.trim() || null) : user.email;
  const newRole        = (isAdmin && role) ? role : user.role;
  const newHash        = password ? bcrypt.hashSync(password, 10) : user.password_hash;

  db.prepare('UPDATE users SET display_name = ?, username = ?, email = ?, password_hash = ?, role = ? WHERE id = ?')
    .run(newDisplayName, newUsername, newEmail, newHash, newRole, targetId);

  res.json(db.prepare(`SELECT ${SAFE} FROM users WHERE id = ?`).get(targetId));
}));

// DELETE /api/users/:id — admin only, cannot delete self
// FK ON DELETE SET NULL ensures games/goals/player_of_game.created_by is nulled automatically
router.delete('/:id', requireAdmin, wrap((req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ deleted: true, id: targetId });
}));

module.exports = router;
