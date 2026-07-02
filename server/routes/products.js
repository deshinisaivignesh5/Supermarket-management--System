const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Get all products (with category/supplier names), supports ?search= and ?lowStock=1
router.get('/', (req, res) => {
  const { search, lowStock, category_id } = req.query;
  let query = `
    SELECT p.*, c.name AS category_name, s.name AS supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (search) {
    query += ` AND (p.name LIKE ? OR p.sku LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category_id) {
    query += ` AND p.category_id = ?`;
    params.push(category_id);
  }
  if (lowStock === '1') {
    query += ` AND p.quantity <= p.reorder_level`;
  }
  query += ` ORDER BY p.name`;
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT p.*, c.name AS category_name, s.name AS supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { sku, name, category_id, supplier_id, cost_price, sell_price, quantity, reorder_level, unit } = req.body;
  if (!sku || !name) return res.status(400).json({ error: 'SKU and name are required' });
  try {
    const stmt = db.prepare(`INSERT INTO products
      (sku, name, category_id, supplier_id, cost_price, sell_price, quantity, reorder_level, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(
      sku, name, category_id || null, supplier_id || null,
      cost_price || 0, sell_price || 0, quantity || 0, reorder_level || 10, unit || 'pcs'
    );
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const { sku, name, category_id, supplier_id, cost_price, sell_price, quantity, reorder_level, unit } = req.body;
  try {
    const stmt = db.prepare(`UPDATE products SET
      sku=?, name=?, category_id=?, supplier_id=?, cost_price=?, sell_price=?, quantity=?, reorder_level=?, unit=?
      WHERE id=?`);
    const info = stmt.run(
      sku, name, category_id || null, supplier_id || null,
      cost_price || 0, sell_price || 0, quantity || 0, reorder_level || 10, unit || 'pcs',
      req.params.id
    );
    if (info.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true });
});

// Adjust stock (restock or manual correction)
router.post('/:id/adjust-stock', (req, res) => {
  const { delta } = req.body; // positive or negative integer
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const newQty = product.quantity + Number(delta);
  if (newQty < 0) return res.status(400).json({ error: 'Stock cannot go negative' });
  db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(newQty, req.params.id);
  res.json({ success: true, quantity: newQty });
});

module.exports = router;
