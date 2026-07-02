const express = require('express');
const router = express.Router();
const db = require('../db/database');

function generateInvoiceNo() {
  const date = new Date();
  const stamp = date.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `INV-${stamp}-${Math.floor(Math.random() * 900 + 100)}`;
}

// Create a sale (checkout). body: { items: [{product_id, quantity}], discount, tax, payment_method }
router.post('/', (req, res) => {
  const { items, discount = 0, tax = 0, payment_method = 'cash' } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'No items in sale' });

  const createSale = db.transaction(() => {
    let total = 0;
    const lineItems = [];

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      if (product.quantity < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);
      const subtotal = product.sell_price * item.quantity;
      total += subtotal;
      lineItems.push({ product, quantity: item.quantity, subtotal });
    }

    const grandTotal = total - Number(discount) + Number(tax);
    const invoiceNo = generateInvoiceNo();

    const saleInfo = db.prepare(`INSERT INTO sales (invoice_no, total_amount, discount, tax, payment_method)
      VALUES (?, ?, ?, ?, ?)`).run(invoiceNo, grandTotal, discount, tax, payment_method);

    const saleId = saleInfo.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)`);
    const updateStock = db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?');

    for (const li of lineItems) {
      insertItem.run(saleId, li.product.id, li.product.name, li.quantity, li.product.sell_price, li.subtotal);
      updateStock.run(li.quantity, li.product.id);
    }

    return { saleId, invoiceNo, grandTotal };
  });

  try {
    const result = createSale();
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// List sales
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM sales ORDER BY created_at DESC LIMIT 200').all();
  res.json(rows);
});

// Get single sale with items (invoice detail)
router.get('/:id', (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  res.json({ ...sale, items });
});

// Dashboard summary stats
router.get('/reports/summary', (req, res) => {
  const todayRevenue = db.prepare(`
    SELECT COALESCE(SUM(total_amount),0) total, COUNT(*) count
    FROM sales WHERE date(created_at) = date('now')
  `).get();

  const totalRevenue = db.prepare(`SELECT COALESCE(SUM(total_amount),0) total FROM sales`).get();

  const lowStockCount = db.prepare(`SELECT COUNT(*) c FROM products WHERE quantity <= reorder_level`).get();

  const totalProducts = db.prepare(`SELECT COUNT(*) c FROM products`).get();

  const topProducts = db.prepare(`
    SELECT product_name, SUM(quantity) total_sold, SUM(subtotal) revenue
    FROM sale_items
    GROUP BY product_id
    ORDER BY total_sold DESC
    LIMIT 5
  `).all();

  const inventoryValue = db.prepare(`SELECT COALESCE(SUM(quantity * cost_price), 0) v FROM products`).get();

  res.json({
    todayRevenue: todayRevenue.total,
    todaySalesCount: todayRevenue.count,
    totalRevenue: totalRevenue.total,
    lowStockCount: lowStockCount.c,
    totalProducts: totalProducts.c,
    inventoryValue: inventoryValue.v,
    topProducts
  });
});

module.exports = router;
