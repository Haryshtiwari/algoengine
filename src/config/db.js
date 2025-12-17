/**
 * Database Connection Pool
 * Uses mysql2 with promise support
 */

const mysql = require('mysql2/promise');
const logger = require('./logger');

let pool = null;

/**
 * Initialize database connection pool
 */
async function initDB() {
  if (pool) {
    return pool;
  }

  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    // Test connection
    const connection = await pool.getConnection();
    logger.info('✓ Database connected successfully');
    connection.release();

    return pool;
  } catch (error) {
    logger.error('✗ Database connection failed:', error);
    throw error;
  }
}

/**
 * Get database pool instance
 */
function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return pool;
}

/**
 * Execute a query
 */
async function query(sql, params = []) {
  const connection = await getPool().getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows;
  } catch (error) {
    logger.error('Query error:', { sql, params, error: error.message });
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Execute a transaction
 */
async function transaction(callback) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error('Transaction error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Close database connection pool
 */
async function closeDB() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

module.exports = {
  initDB,
  getPool,
  query,
  transaction,
  closeDB,
};
