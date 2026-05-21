const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const query = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params);

  if (Array.isArray(result)) {
    return { rows: result };
  }

  return {
    rows: [],
    ...result,
  };
};

module.exports = {
  query,
  pool,
};
