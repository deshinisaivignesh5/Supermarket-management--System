const API = '/api';
let state = {
  products: [],
  categories: [],
  suppliers: [],
  cart: [], // {product, quantity}
};

document.getElementById('current-date').textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// ---------- Utilities ----------
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast-msg ${type}`;
  el.textContent = msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function money(n) {
  return '₹' + Number(n).toFixed(2);
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---------- Navigation ----------
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(view) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.getElementById(`view-${view}`).style.display = 'block';
  const titles = {
    dashboard: 'Dashboard', pos: 'Point of Sale', inventory: 'Inventory',
    sales: 'Sales History', settings: 'Categories & Suppliers'
  };
  document.getElementById('view-title').textContent = titles[view];
  if (view === 'dashboard') renderDashboard();
  if (view === 'pos') renderPOS();
  if (view === 'inventory') renderInventory();
  if (view === 'sales') renderSalesHistory();
  if (view === 'settings') renderSettings();
}

// ---------- Data loading ----------
async function loadCoreData() {
  const [products, categories, suppliers] = await Promise.all([
    api('/products'), api('/categories'), api('/suppliers')
  ]);
  state.products = products;
  state.categories = categories;
  state.suppliers = suppliers;
}

// ---------- Dashboard ----------
async function renderDashboard() {
  const el = document.getElementById('view-dashboard');
  el.innerHTML = '<div class="empty-state">Loading...</div>';
  const summary = await api('/sales/reports/summary');

  el.innerHTML = `
    <div class="cards">
      <div class="card success">
        <div class="label">Today's Revenue</div>
        <div class="value">${money(summary.todayRevenue)}</div>
      </div>
      <div class="card">
        <div class="label">Today's Sales</div>
        <div class="value">${summary.todaySalesCount}</div>
      </div>
      <div class="card">
        <div class="label">Total Revenue</div>
        <div class="value">${money(summary.totalRevenue)}</div>
      </div>
      <div class="card ${summary.lowStockCount > 0 ? 'danger' : ''}">
        <div class="label">Low Stock Items</div>
        <div class="value">${summary.lowStockCount}</div>
      </div>
      <div class="card">
        <div class="label">Total Products</div>
        <div class="value">${summary.totalProducts}</div>
      </div>
      <div class="card">
        <div class="label">Inventory Value (cost)</div>
        <div class="value">${money(summary.inventoryValue)}</div>
      </div>
    </div>

    <div class="panel">
      <h2>Top Selling Products</h2>
      ${summary.topProducts.length ? `
        <table>
          <thead><tr><th>Product</th><th>Units Sold</th><th>Revenue</th></tr></thead>
          <tbody>
            ${summary.topProducts.map(p => `
              <tr><td>${p.product_name}</td><td>${p.total_sold}</td><td>${money(p.revenue)}</td></tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div class="empty-state">No sales recorded yet</div>'}
    </div>
  `;
}

// ---------- POS ----------
async function renderPOS() {
  await loadCoreData();
  const el = document.getElementById('view-pos');
  el.innerHTML = `
    <div class="pos-grid">
      <div>
        <div class="toolbar">
          <input type="text" id="pos-search" placeholder="Search products by name or SKU..." style="flex:1" />
        </div>
        <div class="product-grid" id="pos-product-grid"></div>
      </div>
      <div class="panel">
        <h2>Cart</h2>
        <div id="cart-list"></div>
        <div class="cart-summary">
          <div class="row"><span>Subtotal</span><span id="cart-subtotal">₹0.00</span></div>
          <div class="row"><span>Discount</span><input id="cart-discount" type="number" value="0" min="0" style="width:90px" /></div>
          <div class="row"><span>Tax</span><input id="cart-tax" type="number" value="0" min="0" style="width:90px" /></div>
          <div class="row total"><span>Total</span><span id="cart-total">₹0.00</span></div>
        </div>
        <div class="form-group" style="margin-top:14px">
          <label>Payment Method</label>
          <select id="payment-method">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
          </select>
        </div>
        <button class="btn" style="width:100%" id="checkout-btn">Complete Sale</button>
      </div>
    </div>
  `;

  document.getElementById('pos-search').addEventListener('input', e => renderPOSGrid(e.target.value));
  document.getElementById('cart-discount').addEventListener('input', renderCart);
  document.getElementById('cart-tax').addEventListener('input', renderCart);
  document.getElementById('checkout-btn').addEventListener('click', checkout);

  renderPOSGrid('');
  renderCart();
}

function renderPOSGrid(filter) {
  const grid = document.getElementById('pos-product-grid');
  const filtered = state.products.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase()) || p.sku.toLowerCase().includes(filter.toLowerCase())
  );
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state">No products found</div>';
    return;
  }
  grid.innerHTML = filtered.map(p => `
    <div class="product-tile ${p.quantity <= 0 ? 'disabled' : ''}" data-id="${p.id}">
      <div class="name">${p.name}</div>
      <div class="price">${money(p.sell_price)}</div>
      <div class="stock">${p.quantity > 0 ? `${p.quantity} ${p.unit} in stock` : 'Out of stock'}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.product-tile:not(.disabled)').forEach(tile => {
    tile.addEventListener('click', () => addToCart(Number(tile.dataset.id)));
  });
}

function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  const existing = state.cart.find(c => c.product.id === productId);
  const currentQty = existing ? existing.quantity : 0;
  if (currentQty + 1 > product.quantity) {
    toast('Not enough stock available', 'error');
    return;
  }
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ product, quantity: 1 });
  }
  renderCart();
}

function changeCartQty(productId, delta) {
  const item = state.cart.find(c => c.product.id === productId);
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    state.cart = state.cart.filter(c => c.product.id !== productId);
  } else if (newQty > item.product.quantity) {
    toast('Not enough stock available', 'error');
    return;
  } else {
    item.quantity = newQty;
  }
  renderCart();
}

function renderCart() {
  const list = document.getElementById('cart-list');
  if (!state.cart.length) {
    list.innerHTML = '<div class="empty-state">Cart is empty</div>';
  } else {
    list.innerHTML = state.cart.map(c => `
      <div class="cart-item">
        <div>
          <div style="font-weight:600">${c.product.name}</div>
          <div style="font-size:0.8rem;color:var(--muted)">${money(c.product.sell_price)} x ${c.quantity}</div>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" data-action="dec" data-id="${c.product.id}">−</button>
          <span>${c.quantity}</span>
          <button class="qty-btn" data-action="inc" data-id="${c.product.id}">+</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        changeCartQty(id, btn.dataset.action === 'inc' ? 1 : -1);
      });
    });
  }

  const subtotal = state.cart.reduce((sum, c) => sum + c.product.sell_price * c.quantity, 0);
  const discount = Number(document.getElementById('cart-discount')?.value || 0);
  const tax = Number(document.getElementById('cart-tax')?.value || 0);
  const total = subtotal - discount + tax;

  document.getElementById('cart-subtotal').textContent = money(subtotal);
  document.getElementById('cart-total').textContent = money(Math.max(total, 0));
}

async function checkout() {
  if (!state.cart.length) {
    toast('Cart is empty', 'error');
    return;
  }
  const discount = Number(document.getElementById('cart-discount').value || 0);
  const tax = Number(document.getElementById('cart-tax').value || 0);
  const payment_method = document.getElementById('payment-method').value;

  try {
    const result = await api('/sales', {
      method: 'POST',
      body: JSON.stringify({
        items: state.cart.map(c => ({ product_id: c.product.id, quantity: c.quantity })),
        discount, tax, payment_method
      })
    });
    toast(`Sale complete: ${result.invoiceNo} — ${money(result.grandTotal)}`, 'success');
    state.cart = [];
    await loadCoreData();
    renderPOSGrid(document.getElementById('pos-search').value || '');
    renderCart();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ---------- Inventory ----------
async function renderInventory() {
  await loadCoreData();
  const el = document.getElementById('view-inventory');
  el.innerHTML = `
    <div class="toolbar">
      <input type="text" id="inv-search" placeholder="Search by name or SKU..." style="flex:1" />
      <select id="inv-category-filter"><option value="">All Categories</option></select>
      <label style="display:flex;align-items:center;gap:6px;font-size:0.9rem">
        <input type="checkbox" id="inv-lowstock-filter" /> Low stock only
      </label>
      <button class="btn" id="add-product-btn">+ Add Product</button>
    </div>
    <div class="panel">
      <table>
        <thead>
          <tr><th>SKU</th><th>Name</th><th>Category</th><th>Cost</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr>
        </thead>
        <tbody id="inv-table-body"></tbody>
      </table>
    </div>
  `;

  const catSelect = document.getElementById('inv-category-filter');
  state.categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    catSelect.appendChild(opt);
  });

  document.getElementById('inv-search').addEventListener('input', renderInventoryTable);
  catSelect.addEventListener('change', renderInventoryTable);
  document.getElementById('inv-lowstock-filter').addEventListener('change', renderInventoryTable);
  document.getElementById('add-product-btn').addEventListener('click', () => openProductModal());

  renderInventoryTable();
}

function renderInventoryTable() {
  const search = (document.getElementById('inv-search').value || '').toLowerCase();
  const catFilter = document.getElementById('inv-category-filter').value;
  const lowStockOnly = document.getElementById('inv-lowstock-filter').checked;

  let rows = state.products.filter(p =>
    (p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search)) &&
    (!catFilter || String(p.category_id) === catFilter) &&
    (!lowStockOnly || p.quantity <= p.reorder_level)
  );

  const tbody = document.getElementById('inv-table-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No products found</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(p => `
    <tr>
      <td>${p.sku}</td>
      <td>${p.name}</td>
      <td>${p.category_name || '—'}</td>
      <td>${money(p.cost_price)}</td>
      <td>${money(p.sell_price)}</td>
      <td>${p.quantity} ${p.unit}</td>
      <td>${p.quantity <= p.reorder_level ? '<span class="badge low">Low Stock</span>' : '<span class="badge ok">In Stock</span>'}</td>
      <td>
        <button class="btn small secondary" data-action="edit" data-id="${p.id}">Edit</button>
        <button class="btn small secondary" data-action="restock" data-id="${p.id}">Restock</button>
        <button class="btn small danger" data-action="delete" data-id="${p.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button').forEach(btn => {
    const id = Number(btn.dataset.id);
    const product = state.products.find(p => p.id === id);
    if (btn.dataset.action === 'edit') btn.addEventListener('click', () => openProductModal(product));
    if (btn.dataset.action === 'delete') btn.addEventListener('click', () => deleteProduct(id));
    if (btn.dataset.action === 'restock') btn.addEventListener('click', () => restockProduct(product));
  });
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  try {
    await api(`/products/${id}`, { method: 'DELETE' });
    toast('Product deleted', 'success');
    await loadCoreData();
    renderInventoryTable();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function restockProduct(product) {
  const amount = prompt(`Add how many units to "${product.name}"? (current: ${product.quantity})`);
  if (amount === null) return;
  const delta = Number(amount);
  if (!delta || delta <= 0) { toast('Enter a valid positive number', 'error'); return; }
  try {
    await api(`/products/${product.id}/adjust-stock`, { method: 'POST', body: JSON.stringify({ delta }) });
    toast(`Stock updated for ${product.name}`, 'success');
    await loadCoreData();
    renderInventoryTable();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function openProductModal(product = null) {
  const isEdit = !!product;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${isEdit ? 'Edit Product' : 'Add Product'}</h2>
      <div class="form-group"><label>SKU</label><input id="f-sku" value="${product?.sku || ''}" /></div>
      <div class="form-group"><label>Name</label><input id="f-name" value="${product?.name || ''}" /></div>
      <div class="form-group"><label>Category</label>
        <select id="f-category">
          <option value="">—</option>
          ${state.categories.map(c => `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Supplier</label>
        <select id="f-supplier">
          <option value="">—</option>
          ${state.suppliers.map(s => `<option value="${s.id}" ${product?.supplier_id === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Cost Price</label><input id="f-cost" type="number" step="0.01" value="${product?.cost_price ?? 0}" /></div>
      <div class="form-group"><label>Sell Price</label><input id="f-price" type="number" step="0.01" value="${product?.sell_price ?? 0}" /></div>
      <div class="form-group"><label>Quantity</label><input id="f-qty" type="number" value="${product?.quantity ?? 0}" /></div>
      <div class="form-group"><label>Reorder Level</label><input id="f-reorder" type="number" value="${product?.reorder_level ?? 10}" /></div>
      <div class="form-group"><label>Unit</label><input id="f-unit" value="${product?.unit || 'pcs'}" /></div>
      <div class="modal-actions">
        <button class="btn secondary" id="modal-cancel">Cancel</button>
        <button class="btn" id="modal-save">${isEdit ? 'Save Changes' : 'Add Product'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#modal-save').addEventListener('click', async () => {
    const payload = {
      sku: document.getElementById('f-sku').value.trim(),
      name: document.getElementById('f-name').value.trim(),
      category_id: document.getElementById('f-category').value || null,
      supplier_id: document.getElementById('f-supplier').value || null,
      cost_price: Number(document.getElementById('f-cost').value),
      sell_price: Number(document.getElementById('f-price').value),
      quantity: Number(document.getElementById('f-qty').value),
      reorder_level: Number(document.getElementById('f-reorder').value),
      unit: document.getElementById('f-unit').value.trim() || 'pcs',
    };
    if (!payload.sku || !payload.name) { toast('SKU and name are required', 'error'); return; }

    try {
      if (isEdit) {
        await api(`/products/${product.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast('Product updated', 'success');
      } else {
        await api('/products', { method: 'POST', body: JSON.stringify(payload) });
        toast('Product added', 'success');
      }
      overlay.remove();
      await loadCoreData();
      renderInventoryTable();
    } catch (e) {
      toast(e.message, 'error');
    }
  });
}

// ---------- Sales History ----------
async function renderSalesHistory() {
  const el = document.getElementById('view-sales');
  el.innerHTML = '<div class="empty-state">Loading...</div>';
  const sales = await api('/sales');

  if (!sales.length) {
    el.innerHTML = '<div class="panel"><div class="empty-state">No sales recorded yet</div></div>';
    return;
  }

  el.innerHTML = `
    <div class="panel">
      <table>
        <thead><tr><th>Invoice</th><th>Date</th><th>Payment</th><th>Total</th><th></th></tr></thead>
        <tbody>
          ${sales.map(s => `
            <tr>
              <td>${s.invoice_no}</td>
              <td>${new Date(s.created_at).toLocaleString()}</td>
              <td style="text-transform:capitalize">${s.payment_method}</td>
              <td>${money(s.total_amount)}</td>
              <td><button class="btn small secondary" data-id="${s.id}">View</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  el.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', () => viewInvoice(Number(btn.dataset.id)));
  });
}

async function viewInvoice(saleId) {
  const sale = await api(`/sales/${saleId}`);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${sale.invoice_no}</h2>
      <p style="color:var(--muted);margin-top:-10px">${new Date(sale.created_at).toLocaleString()} · ${sale.payment_method}</p>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
        <tbody>
          ${sale.items.map(i => `
            <tr><td>${i.product_name}</td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(i.subtotal)}</td></tr>
          `).join('')}
        </tbody>
      </table>
      <div class="cart-summary">
        <div class="row"><span>Discount</span><span>${money(sale.discount)}</span></div>
        <div class="row"><span>Tax</span><span>${money(sale.tax)}</span></div>
        <div class="row total"><span>Total</span><span>${money(sale.total_amount)}</span></div>
      </div>
      <div class="modal-actions">
        <button class="btn secondary" id="modal-close">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ---------- Settings (Categories & Suppliers) ----------
async function renderSettings() {
  await loadCoreData();
  const el = document.getElementById('view-settings');
  el.innerHTML = `
    <div class="pos-grid">
      <div class="panel">
        <h2>Categories</h2>
        <div class="toolbar">
          <input id="new-cat-name" placeholder="New category name" style="flex:1" />
          <button class="btn" id="add-cat-btn">Add</button>
        </div>
        <table>
          <tbody id="cat-table-body"></tbody>
        </table>
      </div>
      <div class="panel">
        <h2>Suppliers</h2>
        <div class="form-group"><input id="new-sup-name" placeholder="Supplier name" /></div>
        <div class="form-group"><input id="new-sup-phone" placeholder="Phone" /></div>
        <div class="form-group"><input id="new-sup-email" placeholder="Email" /></div>
        <button class="btn" id="add-sup-btn" style="width:100%">Add Supplier</button>
        <table style="margin-top:16px">
          <tbody id="sup-table-body"></tbody>
        </table>
      </div>
    </div>
  `;

  renderCatTable();
  renderSupTable();

  document.getElementById('add-cat-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-cat-name').value.trim();
    if (!name) return;
    try {
      await api('/categories', { method: 'POST', body: JSON.stringify({ name }) });
      document.getElementById('new-cat-name').value = '';
      await loadCoreData();
      renderCatTable();
      toast('Category added');
    } catch (e) { toast(e.message, 'error'); }
  });

  document.getElementById('add-sup-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-sup-name').value.trim();
    const phone = document.getElementById('new-sup-phone').value.trim();
    const email = document.getElementById('new-sup-email').value.trim();
    if (!name) { toast('Supplier name required', 'error'); return; }
    try {
      await api('/suppliers', { method: 'POST', body: JSON.stringify({ name, phone, email }) });
      document.getElementById('new-sup-name').value = '';
      document.getElementById('new-sup-phone').value = '';
      document.getElementById('new-sup-email').value = '';
      await loadCoreData();
      renderSupTable();
      toast('Supplier added');
    } catch (e) { toast(e.message, 'error'); }
  });
}

function renderCatTable() {
  const body = document.getElementById('cat-table-body');
  body.innerHTML = state.categories.map(c => `
    <tr><td>${c.name}</td><td style="text-align:right"><button class="btn small danger" data-id="${c.id}">Delete</button></td></tr>
  `).join('') || '<tr><td class="empty-state">No categories yet</td></tr>';
  body.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/categories/${btn.dataset.id}`, { method: 'DELETE' });
      await loadCoreData();
      renderCatTable();
      toast('Category removed');
    });
  });
}

function renderSupTable() {
  const body = document.getElementById('sup-table-body');
  body.innerHTML = state.suppliers.map(s => `
    <tr><td>${s.name}<br><small style="color:var(--muted)">${s.phone || ''} ${s.email || ''}</small></td>
    <td style="text-align:right"><button class="btn small danger" data-id="${s.id}">Delete</button></td></tr>
  `).join('') || '<tr><td class="empty-state">No suppliers yet</td></tr>';
  body.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/suppliers/${btn.dataset.id}`, { method: 'DELETE' });
      await loadCoreData();
      renderSupTable();
      toast('Supplier removed');
    });
  });
}

// ---------- Init ----------
(async function init() {
  await loadCoreData();
  renderDashboard();
})();
