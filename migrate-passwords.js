const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./database.db');
const SALT_ROUNDS = 10;

db.all('SELECT id, nome, senha FROM users', async (err, rows) => {
  if (err) {
    console.error('Erro ao ler usuários:', err);
    process.exit(1);
  }
  if (!rows || !rows.length) {
    console.log('Nenhum usuário encontrado.');
    process.exit(0);
  }

  for (const u of rows) {
    const current = u.senha || '';
    // se já parece hash bcrypt (começa com $2), pula
    if (current.startsWith('$2')) {
      console.log(`${u.nome} já possui senha hashed — pulando.`);
      continue;
    }
    try {
      const hash = bcrypt.hashSync(current, SALT_ROUNDS);
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET senha = ? WHERE id = ?', [hash, u.id], function (e) {
          if (e) return reject(e);
          console.log(`Senha do usuário ${u.nome} migrada.`);
          resolve();
        });
      });
    } catch (e) {
      console.error('Erro ao migrar usuário', u.nome, e);
    }
  }

  console.log('Migração concluída.');
  db.close();
});