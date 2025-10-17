// frontend integrado ao backend (http://localhost:4000)
let currentUser = null;
let userType = null;
let menuItems = [];
let orders = [];
let cart = [];

const STORAGE_KEYS = {
  CLIENT: 'clientUser',
  CART: 'cart',
  ADMIN: 'adminUser',
  ADMIN_TOKEN: 'adminToken'
};

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  showScreen('client');
  loadClientSession();
  loadCartFromStorage();
  verifyAdminSessionOnLoad();
  fetchMenuItems();
  fetchOrders();
});

function initUI() {
  const clientLoginBtn = document.getElementById('client-login-btn');
  if (clientLoginBtn) clientLoginBtn.addEventListener('click', openClientLogin);

  const cartBtn = document.getElementById('cart-btn');
  if (cartBtn) cartBtn.addEventListener('click', () => showClientSection('carrinho'));

  const clientLoginForm = document.getElementById('client-login-form');
  if (clientLoginForm) clientLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('client-login-name').value.trim();
    const senha = document.getElementById('client-login-pass').value.trim();
    if (!nome || !senha) return showAlert('Preencha usuário e senha', 'danger');

    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ nome, senha })
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({message:'Erro'}));
        showAlert(d.message || 'Usuário ou senha inválidos', 'danger');
        return;
      }
      const data = await res.json();
      currentUser = data.nome;
      userType = data.tipo || 'cliente';
      // salvar sessão cliente localmente
      localStorage.setItem(STORAGE_KEYS.CLIENT, JSON.stringify({ nome: currentUser, tipo: userType }));
      document.getElementById('client-name').textContent = currentUser;
      const logoutEl = document.getElementById('client-logout');
      if (logoutEl) logoutEl.style.display = 'inline';
      closeClientLogin();
      // preencher automaticamente o campo de entrega
      const deliveryName = document.getElementById('delivery-name');
      if (deliveryName) deliveryName.value = currentUser;
      showAlert('Bem-vindo, ' + currentUser, 'success');
    } catch (err) {
      console.error(err);
      showAlert('Erro ao conectar ao servidor', 'danger');
    }
  });

  const clientLogout = document.getElementById('client-logout');
  if (clientLogout) clientLogout.addEventListener('click', (e) => { e.preventDefault(); logout(); });

  const itemForm = document.getElementById('item-form');
  if (itemForm) itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('item-nome').value.trim();
    const descricao = document.getElementById('item-descricao').value.trim();
    const preco = parseFloat(document.getElementById('item-preco').value) || 0;
    const categoria = document.getElementById('item-categoria').value || '';
    const disponivel = document.getElementById('item-disponivel').checked;
    if (!nome) return showAlert('Nome obrigatório', 'danger');

    const token = getAdminToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch('/api/menu', { method:'POST', headers, body: JSON.stringify({ nome, descricao, preco, categoria, disponivel })});
    if (res.ok) { showAlert('Item salvo', 'success'); fetchMenuItems(); itemForm.reset(); } else {
      const d = await res.json().catch(()=>({error:'Erro'}));
      showAlert(d.error || 'Erro ao salvar', 'danger');
      if (d.error && d.error.toLowerCase().includes('sess')) {
        // token possivelmente expirado
        clearAdminSession();
      }
    }
  });

  const orderForm = document.getElementById('order-form');
  if (orderForm) orderForm.addEventListener('submit', async (e) => { e.preventDefault(); await finalizeOrder(); });
}

function openClientLogin() { const m = document.getElementById('client-login-modal'); if (m) m.style.display = 'block'; }
function closeClientLogin() { const m = document.getElementById('client-login-modal'); if (m) m.style.display = 'none'; }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id + '-screen');
  if (el) { el.classList.add('active'); el.style.display = 'block'; }
  document.querySelectorAll('.screen:not(.active)').forEach(s => s.style.display = 'none');
}

// session & cart persistence
function loadClientSession() {
  const raw = localStorage.getItem(STORAGE_KEYS.CLIENT);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    currentUser = data.nome || null;
    userType = data.tipo || 'cliente';
    if (currentUser) {
      const nameEl = document.getElementById('client-name'); if (nameEl) nameEl.textContent = currentUser;
      const logoutEl = document.getElementById('client-logout'); if (logoutEl) logoutEl.style.display = 'inline';
      const deliveryName = document.getElementById('delivery-name'); if (deliveryName) deliveryName.value = currentUser;
    }
  } catch {}
}

function saveCartToStorage() {
  try { localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart)); updateCartBadge(); } catch {}
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CART);
    if (!raw) return;
    cart = JSON.parse(raw) || [];
    renderCart();
    updateCartCount();
    updateCartBadge();
  } catch {}
}

function updateCartBadge() {
  const cntEl = document.getElementById('cart-count');
  if (!cntEl) return;
  const qty = cart.reduce((s,i)=>s + (i.quantidade||0), 0);
  cntEl.textContent = qty;
}

function getAdminToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.token) return null;
    // check expiry
    if (data.expiresAt && data.expiresAt < Date.now()) { clearAdminSession(); return null; }
    return data.token;
  } catch { return null; }
}
function clearAdminSession() {
  localStorage.removeItem(STORAGE_KEYS.ADMIN);
  localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
  // reflect UI
  const adminLink = document.getElementById('admin-login-link'); if (adminLink) adminLink.style.display = 'inline';
  // if admin area visible, return to client view
  showScreen('client');
  userType = null; currentUser = null;
  showAlert('Sessão admin expirada', 'info');
}

// verify admin session on load with server
async function verifyAdminSessionOnLoad() {
  const rawUser = localStorage.getItem(STORAGE_KEYS.ADMIN);
  const rawToken = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
  if (!rawUser || !rawToken) return;
  try {
    const tokenObj = JSON.parse(rawToken);
    if (!tokenObj || !tokenObj.token) { clearAdminSession(); return; }
    const res = await fetch('/api/session/verify', {
      headers: { 'Authorization': 'Bearer ' + tokenObj.token }
    });
    if (!res.ok) { clearAdminSession(); return; }
    const data = await res.json();
    // valid session
    currentUser = data.nome;
    userType = data.tipo;
    document.getElementById('admin-name').textContent = currentUser;
    const adminLink = document.getElementById('admin-login-link'); if (adminLink) adminLink.style.display = 'none';
    showScreen('admin');
    showAdminSection('cardapio');
  } catch (err) {
    console.error(err);
    clearAdminSession();
  }
}

// =================== menu & cart ===================
async function fetchMenuItems() {
  try {
    const res = await fetch('/api/menu');
    if (!res.ok) return;
    menuItems = await res.json();
    renderClientMenu();
    renderAdminMenu();
  } catch (err) { console.error(err); }
}

function renderClientMenu() {
  const container = document.getElementById('client-menu-items');
  if (!container) return;
  container.innerHTML = '';
  (menuItems || []).filter(i => i.disponivel == 1 || i.disponivel === true).forEach(it => {
    const div = document.createElement('div'); div.className = 'menu-item-card'; div.dataset.category = it.categoria || '';
    div.innerHTML = `
      <div class="menu-item-title">${escapeHtml(it.nome)}</div>
      <div class="menu-item-description">${escapeHtml(it.descricao||'')}</div>
      <div class="menu-item-footer">
        <div class="menu-item-price">R$ ${Number(it.preco||0).toFixed(2)}</div>
        <div class="quantity-controls">
          <input id="qty-${it.id}" type="number" value="1" min="1" max="99"/>
          <button class="btn btn-primary add-btn">Adicionar</button>
        </div>
      </div>
    `;
    div.querySelector('.add-btn').addEventListener('click', () => {
      const q = parseInt(document.getElementById(`qty-${it.id}`).value) || 1; addToCart(it,q);
    });
    container.appendChild(div);
  });
}

function renderAdminMenu() {
  const container = document.getElementById('admin-menu-items'); if (!container) return;
  container.innerHTML = '';
  (menuItems||[]).forEach(it => {
    const div = document.createElement('div'); div.className='item-card';
    div.innerHTML = `<div class="item-card-title">${escapeHtml(it.nome)}</div>
      <div class="item-card-description">${escapeHtml(it.descricao||'')}</div>
      <div class="item-card-price">R$ ${Number(it.preco||0).toFixed(2)}</div>
      <div class="item-card-actions"><button class="btn btn-danger">Remover</button></div>`;
    div.querySelector('button').addEventListener('click', async ()=> {
      if (!confirm('Remover item?')) return;
      const token = getAdminToken();
      const headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const r = await fetch(`/api/menu/${it.id}`, { method:'DELETE', headers });
      if (r.ok) { showAlert('Removido', 'success'); fetchMenuItems(); } else {
        const d = await r.json().catch(()=>({error:'Erro'}));
        showAlert(d.error || 'Erro', 'danger');
        if (d.error && d.error.toLowerCase().includes('sess')) clearAdminSession();
      }
    });
    container.appendChild(div);
  });
}

function addToCart(item, quantity) {
  const existing = cart.find(c => c.id_item === item.id);
  if (existing) existing.quantidade += quantity;
  else cart.push({ id_item: item.id, nome: item.nome, preco: item.preco, quantidade: quantity });
  saveCartToStorage();
  renderCart(); updateCartCount();
  showAlert('Adicionado ao carrinho', 'success');
}

function renderCart() {
  const container = document.getElementById('cart-items'); if (!container) return;
  container.innerHTML = '';
  if (!cart.length) { container.innerHTML = '<p>Carrinho vazio</p>'; updateCartBadge(); return; }
  cart.forEach((c,idx) => {
    const div = document.createElement('div'); div.className='cart-item';
    div.innerHTML = `<div>${escapeHtml(c.nome)} x ${c.quantidade}</div><div>R$ ${(c.preco*c.quantidade).toFixed(2)}</div>
      <div><button class="btn" data-idx="${idx}" data-op="-">-</button><button class="btn" data-idx="${idx}" data-op="+">+</button>
      <button class="btn btn-danger" data-idx="${idx}" data-op="r">Remover</button></div>`;
    div.querySelectorAll('button').forEach(b => b.addEventListener('click', ()=> {
      const op = b.dataset.op, i = Number(b.dataset.idx);
      if (op === '+') cart[i].quantidade++; if (op === '-') { cart[i].quantidade--; if (cart[i].quantidade<=0) cart.splice(i,1); }
      if (op === 'r') cart.splice(i,1); renderCart(); updateCartCount(); saveCartToStorage();
    }));
    container.appendChild(div);
  });
  updateCartCount(); updateCartBadge();
}

function updateCartCount() {
  const el = document.getElementById('cart-total');
  if (el) {
    const total = cart.reduce((s,i)=>s + (i.preco * i.quantidade),0);
    el.textContent = `Total: R$ ${total.toFixed(2)}`;
  }
}

// =================== orders ===================
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) return;
    orders = await res.json();
    orders.forEach(o => {
      if (typeof o.itens === 'string') {
        try { o.itens = JSON.parse(o.itens); } catch(e){ o.itens = []; }
      }
    });
    renderPendingOrders(); renderAcceptedOrders(); renderOrdersHistory(); renderMyOrders(); updatePendingCount();
  } catch (err) { console.error(err); }
}

function renderPendingOrders() {
  const container = document.getElementById('pending-orders-list'); if (!container) return;
  container.innerHTML = ''; const pending = (orders||[]).filter(o => o.status==='pendente');
  if (!pending.length) { container.innerHTML = '<p>Nenhum pedido pendente</p>'; return; }
  pending.forEach(o => container.appendChild(buildOrderCard(o,true)));
}

function renderAcceptedOrders() {
  const container = document.getElementById('accepted-orders-list'); if (!container) return; container.innerHTML='';
  (orders||[]).filter(o=>o.status==='aceito').forEach(o => {
    const card = buildOrderCard(o,false);
    const btn = document.createElement('button'); btn.className='btn btn-primary'; btn.textContent='Imprimir'; btn.addEventListener('click', ()=> openPrintModal(o));
    card.querySelector('.order-actions').appendChild(btn);
    container.appendChild(card);
  });
}

function renderOrdersHistory() {
  const container = document.getElementById('orders-history'); if (!container) return; container.innerHTML='';
  (orders||[]).forEach(o => container.appendChild(buildOrderCard(o,false)));
}

function renderMyOrders() {
  const container = document.getElementById('my-orders-list'); if (!container) return; container.innerHTML='';
  if (!currentUser) return;
  (orders||[]).filter(o => o.cliente === currentUser).forEach(o => container.appendChild(buildOrderCard(o,false)));
}

function updatePendingCount() { const el = document.getElementById('pending-count'); if (!el) return; el.textContent = (orders||[]).filter(o=>o.status==='pendente').length; }

function buildOrderCard(o, showActions=false) {
  const div = document.createElement('div'); div.className='order-card';
  const itemsHtml = (o.itens||[]).map(i=>`<div>${escapeHtml(i.nome)} x ${i.quantidade} - R$ ${(i.preco*i.quantidade).toFixed(2)}</div>`).join('');
  div.innerHTML = `<div class="order-header"><div><strong>Pedido #${o.id}</strong> — ${escapeHtml(o.cliente)}</div><div class="order-status">${escapeHtml(o.status||'')}</div></div>
    <div class="order-items">${itemsHtml}</div><div class="order-total">Total: R$ ${Number(o.total||0).toFixed(2)}</div><div class="order-actions"></div>`;
  if (showActions) {
    const accept = document.createElement('button'); accept.className='btn btn-success'; accept.innerHTML='<i class="fas fa-check"></i> Aceitar';
    const reject = document.createElement('button'); reject.className='btn btn-danger'; reject.innerHTML='<i class="fas fa-times"></i> Rejeitar';
    accept.addEventListener('click', ()=> acceptOrder(o.id)); reject.addEventListener('click', ()=> rejectOrder(o.id));
    div.querySelector('.order-actions').appendChild(accept); div.querySelector('.order-actions').appendChild(reject);
  }
  return div;
}

async function finalizeOrder() {
  if (!cart.length) return showAlert('Carrinho vazio','danger');
  const cliente = document.getElementById('delivery-name').value.trim();
  const telefone = document.getElementById('delivery-phone').value.trim();
  const endereco = document.getElementById('delivery-address').value.trim();
  if (!cliente || !telefone || !endereco) return showAlert('Preencha dados de entrega','danger');
  const total = cart.reduce((s,i)=>s + i.preco*i.quantidade,0);
  const pedido = { cliente, telefone, endereco, itens: cart, total, status:'pendente', timestamp: new Date().toISOString(), comentarios:'' };
  const res = await fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(pedido) });
  if (res.ok) { showAlert('Pedido enviado','success'); cart=[]; renderCart(); updateCartCount(); saveCartToStorage(); fetchOrders(); showClientSection('meus-pedidos'); } else showAlert('Erro ao enviar','danger');
}

async function acceptOrder(id) {
  const token = getAdminToken();
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(`/api/orders/${id}/accept`, { method:'PUT', headers });
  if (res.ok) { showAlert('Pedido aceito','success'); fetchOrders(); } else {
    const d = await res.json().catch(()=>({error:'Erro'})); showAlert(d.error || 'Erro ao aceitar', 'danger');
    if (d.error && d.error.toLowerCase().includes('sess')) clearAdminSession();
  }
}

async function rejectOrder(id) {
  const token = getAdminToken();
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(`/api/orders/${id}/reject`, { method:'PUT', headers });
  if (res.ok) { showAlert('Pedido rejeitado','success'); fetchOrders(); } else {
    const d = await res.json().catch(()=>({error:'Erro'})); showAlert(d.error || 'Erro', 'danger');
    if (d.error && d.error.toLowerCase().includes('sess')) clearAdminSession();
  }
}

// print modal
function openPrintModal(order) {
  const modal = document.getElementById('print-modal'); const body = document.getElementById('print-body');
  const items = (order.itens||[]).map(i=>`<div>${escapeHtml(i.nome)} x ${i.quantidade} - R$ ${(i.preco*i.quantidade).toFixed(2)}</div>`).join('');
  if (!modal || !body) return;
  body.innerHTML = `<h3>Pedido #${order.id}</h3>
    <div>Cliente: ${escapeHtml(order.cliente)}</div>
    <div>Telefone: ${escapeHtml(order.telefone||'')}</div>
    <div>Endereço: ${escapeHtml(order.endereco||'')}</div>
    <div class="divider"></div>
    ${items}
    <div class="divider"></div>
    <div><strong>Total: R$ ${Number(order.total||0).toFixed(2)}</strong></div>
  `;
  modal.style.display = 'block';
}
function closePrintModal(){ const m=document.getElementById('print-modal'); if(m) m.style.display='none'; }
function printOrder(){ window.print(); }

function showAdminSection(name) { document.querySelectorAll('.admin-section').forEach(s=>s.classList.remove('active')); const el = document.getElementById('admin-' + name); if (el) el.classList.add('active'); }
function showClientSection(name) { document.querySelectorAll('.client-section').forEach(s=>s.classList.remove('active')); const id = (name==='meus-pedidos') ? 'client-meus-pedidos' : (name==='carrinho' ? 'client-carrinho' : 'client-cardapio'); const el = document.getElementById(id); if (el) el.classList.add('active'); }

function filterByCategory(category, btn) { document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active')); if (btn) btn.classList.add('active'); document.querySelectorAll('.menu-item-card').forEach(it => { it.style.display = (!category || it.dataset.category===category) ? 'block' : 'none'; }); }

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showAlert(message, type='info'){ const div=document.createElement('div'); div.className=`alert alert-${type}`; div.textContent=message; div.style.position='fixed'; div.style.top='16px'; div.style.right='16px'; div.style.padding='10px'; div.style.backgroundColor=(type==='success'?'#28a745':type==='danger'?'#dc3545':'#17a2b8'); div.style.color='white'; div.style.zIndex='9999'; document.body.appendChild(div); setTimeout(()=>div.remove(),3000); }
