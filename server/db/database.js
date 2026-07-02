const { DatabaseSync } = require('node:sqlite');
const path = require('path');

class StatementWrapper {
  constructor(statement) {
    this.statement = statement;
  }

  run(...params) {
    return this.statement.run(...params);
  }

  get(...params) {
    return this.statement.get(...params);
  }

  all(...params) {
    return this.statement.all(...params);
  }
}

class DatabaseWrapper {
  constructor(filePath) {
    this.db = new DatabaseSync(filePath);
    this.pragma('journal_mode = WAL');
    this.pragma('foreign_keys = ON');
  }

  pragma(command) {
    this.db.exec(`PRAGMA ${command}`);
    return this;
  }

  exec(sql) {
    this.db.exec(sql);
    return this;
  }

  prepare(query) {
    return new StatementWrapper(this.db.prepare(query));
  }

  transaction(fn) {
    this.db.exec('BEGIN');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

const db = new DatabaseWrapper(path.join(__dirname, 'supermarket.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id INTEGER,
  supplier_id INTEGER,
  cost_price REAL NOT NULL DEFAULT 0,
  sell_price REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  unit TEXT DEFAULT 'pcs',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  total_amount REAL NOT NULL,
  discount REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
`);

// Seed default data if empty
const catCount = db.prepare('SELECT COUNT(*) c FROM categories').get().c;
if (catCount === 0) {
  const insertCat = db.prepare('INSERT INTO categories (name) VALUES (?)');
  const cats = ['Groceries', 'Dairy', 'Beverages', 'Snacks', 'Produce', 'Household'];
  const catIds = {};
  cats.forEach(c => { catIds[c] = insertCat.run(c).lastInsertRowid; });

  const insertSup = db.prepare('INSERT INTO suppliers (name, phone, email) VALUES (?, ?, ?)');
  const supId = insertSup.run('General Distributors Ltd', '9876543210', 'contact@gendist.com').lastInsertRowid;

  const insertProd = db.prepare(`INSERT INTO products
    (sku, name, category_id, supplier_id, cost_price, sell_price, quantity, reorder_level, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const products = [
    ['SKU-1001', 'Basmati Rice 5kg', catIds['Groceries'], supId, 350, 420, 40, 10, 'bag'],
    ['SKU-1002', 'Toor Dal 1kg', catIds['Groceries'], supId, 90, 120, 60, 15, 'pkt'],
    ['SKU-1003', 'Full Cream Milk 1L', catIds['Dairy'], supId, 45, 58, 80, 20, 'pcs'],
    ['SKU-1004', 'Paneer 200g', catIds['Dairy'], supId, 60, 80, 30, 10, 'pkt'],
    ['SKU-1005', 'Coca-Cola 1.25L', catIds['Beverages'], supId, 50, 70, 100, 20, 'pcs'],
    ['SKU-1006', 'Orange Juice 1L', catIds['Beverages'], supId, 70, 95, 35, 10, 'pcs'],
    ['SKU-1007', 'Potato Chips 100g', catIds['Snacks'], supId, 20, 30, 150, 30, 'pkt'],
    ['SKU-1008', 'Chocolate Bar', catIds['Snacks'], supId, 15, 25, 200, 40, 'pcs'],
    ['SKU-1009', 'Onions 1kg', catIds['Produce'], supId, 25, 35, 8, 15, 'kg'],
    ['SKU-1010', 'Tomatoes 1kg', catIds['Produce'], supId, 20, 30, 5, 15, 'kg'],
    ['SKU-1011', 'Dish Soap 500ml', catIds['Household'], supId, 40, 60, 50, 15, 'pcs'],
    ['SKU-1012', 'Laundry Detergent 1kg', catIds['Household'], supId, 110, 150, 25, 10, 'pkt'],
  ];
  products.forEach(p => insertProd.run(...p));
}

module.exports = db;
