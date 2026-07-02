# MarketHub — Supermarket Management System

A full-stack supermarket management web app: Node.js + Express backend, SQLite database, vanilla JS frontend. Runs entirely on your machine.

## Features

- **Dashboard** — today's revenue, total revenue, low-stock alerts, inventory value, top-selling products
- **Point of Sale (POS)** — searchable product grid, cart, discount/tax, checkout that auto-generates an invoice and deducts stock
- **Inventory management** — add/edit/delete products, restock, low-stock filtering, search by name/SKU/category
- **Sales history** — list of all invoices with line-item detail view
- **Categories & Suppliers** — manage product categories and supplier contacts

Data is stored in a local SQLite file (`server/supermarket.db`), created automatically with sample seed data on first run.

## Requirements

- [Node.js](https://nodejs.org/) v18 or newer (includes npm)

## Setup

1. Unzip the project and open a terminal in the `supermarket-app` folder.
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser to:
   ```
   http://localhost:4000
   ```

The database and sample products (rice, milk, snacks, produce, etc.) are seeded automatically the first time you run it.

## Project Structure

```
supermarket-app/
├── package.json
├── server/
│   ├── index.js          # Express server entry point
│   ├── db/
│   │   └── database.js   # SQLite schema + seed data
│   └── routes/
│       ├── products.js   # Product CRUD + stock adjustment
│       ├── sales.js      # Checkout, invoices, dashboard stats
│       └── meta.js       # Categories & suppliers
└── public/
    ├── index.html
    ├── style.css
    └── app.js             # Frontend logic (no framework, no build step)
```

## Notes

- Change the port by setting `PORT=5000 npm start` (default is 4000).
- To reset all data, stop the server and delete `server/supermarket.db` (and the `-wal`/`-shm` files if present) — it will reseed on next start.
- This is a single-user local app with no authentication; don't expose it to the public internet as-is.
