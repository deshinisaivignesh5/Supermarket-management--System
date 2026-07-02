const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Categories
router.get('/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});
router.post('/categories', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Suppliers
router.get('/suppliers', (req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
});
router.post('/suppliers', (req, res) => {
  const { name, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const info = db.prepare('INSERT INTO suppliers (name, phone, email) VALUES (?, ?, ?)').run(name, phone || '', email || '');
  res.status(201).json({ id: info.lastInsertRowid });
});
router.delete('/suppliers/:id', (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
