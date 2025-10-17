const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt'); // adicionado
const SALT_ROUNDS = 10;

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname))); // serve index.html e assets

// Banco de dados SQLite
const db = new sqlite3.Database('./database.db');

// Criação das tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS menuItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    descricao TEXT,
    preco REAL,
    categoria TEXT,
    disponivel INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT,
    telefone TEXT,
    endereco TEXT,
    itens TEXT,
    total REAL,
    status TEXT,
    timestamp TEXT,
    comentarios TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE,
    senha TEXT,
    tipo TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER,
    expires_at INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// helper: create session
function createSessionForUser(userId, cb) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 horas
  db.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [token, userId, expiresAt], function (err) {
    if (err) return cb(err);
    cb(null, { token, expiresAt });
  });
}

// middleware: verify token and attach user
function authenticateToken(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const match = auth.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: 'Token ausente' });
  const token = match[1];

  db.get(`SELECT s.token, s.expires_at, u.id as user_id, u.nome, u.tipo
          FROM sessions s JOIN users u ON s.user_id = u.id
          WHERE s.token = ?`, [token], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    if (!row) return res.status(401).json({ error: 'Sessão inválida' });
    if (row.expires_at < Date.now()) {
      // remover sessão expirada
      db.run('DELETE FROM sessions WHERE token = ?', [token], () => { });
      return res.status(401).json({ error: 'Sessão expirada' });
    }
    req.auth = { token: row.token, user: { id: row.user_id, nome: row.nome, tipo: row.tipo }, expiresAt: row.expires_at };
    next();
  });
}

// middleware: require admin
function requireAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (!req.auth || !req.auth.user || req.auth.user.tipo !== 'admin') return res.status(403).json({ error: 'Acesso negado (admin)' });
    next();
  });
}

// Rotas do cardápio (GET público)
app.get('/api/menu', (req, res) => {
  db.all('SELECT * FROM menuItems ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar menu' });
    res.json(rows);
  });
});

// criar item (admin)
app.post('/api/menu', requireAdmin, (req, res) => {
  const { nome, descricao, preco, categoria, disponivel } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
  db.run(
    'INSERT INTO menuItems (nome, descricao, preco, categoria, disponivel) VALUES (?, ?, ?, ?, ?)',
    [nome, descricao || '', preco || 0, categoria || '', disponivel ? 1 : 0],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao inserir item' });
      res.json({ id: this.lastID });
    }
  );
});

// remover item (admin)
app.delete('/api/menu/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM menuItems WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao remover item' });
    if (this.changes === 0) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ success: true });
  });
});

// Rotas de pedidos (GET público)
app.get('/api/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar pedidos' });
    res.json(rows);
  });
});

// criar pedido (público)
app.post('/api/orders', (req, res) => {
  const { cliente, telefone, endereco, itens, total, status, timestamp, comentarios } = req.body;
  if (!cliente || !telefone || !endereco) return res.status(400).json({ error: 'Dados de entrega incompletos' });
  db.run(
    'INSERT INTO orders (cliente, telefone, endereco, itens, total, status, timestamp, comentarios) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [cliente, telefone, endereco, JSON.stringify(itens || []), total || 0, status || 'pendente', timestamp || new Date().toISOString(), comentarios || ''],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao criar pedido' });
      res.json({ id: this.lastID });
    }
  );
});

// aceitar pedido (admin)
app.put('/api/orders/:id/accept', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.run('UPDATE orders SET status = ? WHERE id = ?', ['aceito', id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao aceitar pedido' });
    if (this.changes === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json({ success: true });
  });
});

// rejeitar pedido (admin)
app.put('/api/orders/:id/reject', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.run('UPDATE orders SET status = ? WHERE id = ?', ['rejeitado', id], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao rejeitar pedido' });
    if (this.changes === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json({ success: true });
  });
});

// Autenticação: registrar com hash de senha
app.post('/api/register', (req, res) => {
  const { nome, senha, tipo } = req.body;
  if (!nome || !senha || !tipo) return res.status(400).json({ error: 'Dados incompletos' });

  bcrypt.hash(senha, SALT_ROUNDS, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Erro ao processar senha' });
    db.run('INSERT INTO users (nome, senha, tipo) VALUES (?, ?, ?)', [nome, hash, tipo], function (err) {
      if (err) return res.status(400).json({ error: 'Usuário já existe ou dados inválidos' });
      res.json({ id: this.lastID });
    });
  });
});

// login: compara hash e cria sessão
app.post('/api/login', (req, res) => {
  const { nome, senha } = req.body;
  if (!nome || !senha) return res.status(400).json({ error: 'Dados incompletos' });
  db.get('SELECT * FROM users WHERE nome = ?', [nome], (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no login' });
    if (!user) return res.status(401).json({ message: 'Usuário ou senha inválidos' });

    // compara com bcrypt
    bcrypt.compare(senha, user.senha, (err2, match) => {
      if (err2) return res.status(500).json({ error: 'Erro no login' });
      if (!match) return res.status(401).json({ message: 'Usuário ou senha inválidos' });

      createSessionForUser(user.id, (err3, sess) => {
        if (err3) return res.status(500).json({ error: 'Erro criando sessão' });
        res.json({ nome: user.nome, tipo: user.tipo, token: sess.token, expiresAt: sess.expiresAt });
      });
    });
  });
});

// verificar sessão (token)
app.get('/api/session/verify', authenticateToken, (req, res) => {
  // authenticateToken já validou sessão e anexou req.auth
  res.json({ nome: req.auth.user.nome, tipo: req.auth.user.tipo, expiresAt: req.auth.expiresAt });
});

// logout (remover sessão)
app.post('/api/logout', authenticateToken, (req, res) => {
  const token = req.auth.token;
  db.run('DELETE FROM sessions WHERE token = ?', [token], function (err) {
    // ignore error in delete for logout
    res.json({ success: true });
  });
});

// iniciar servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API e frontend servidos em http://localhost:${PORT}`);
});