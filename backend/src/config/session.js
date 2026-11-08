const session = require('express-session');
const PgSessionStore = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const secret = process.env.SESSION_SECRET;

if (!secret) {
  throw new Error('Configure SESSION_SECRET antes de iniciar a API.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = session({
  name: 'elo.sid',
  secret,
  store: new PgSessionStore({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
  }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api',
    maxAge: 15 * 60 * 1000,
  },
});