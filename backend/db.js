const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Automatically locate and load backend/.env if environment variables aren't already loaded
const backendEnvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else {
  dotenv.config();
}

/**
 * Builds standard MySQL connection configuration supporting Aiven MySQL SSL/TLS & CA Certs
 */
function getDbConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  let sslConfig = false;

  // Resolve CA certificate path if configured
  const caPathRaw = process.env.DB_SSL_CA_PATH;
  let caBuffer = null;
  let caConfigured = false;

  if (caPathRaw) {
    const caPathResolved = path.isAbsolute(caPathRaw)
      ? caPathRaw
      : path.resolve(__dirname, caPathRaw);

    if (fs.existsSync(caPathResolved)) {
      caBuffer = fs.readFileSync(caPathResolved);
      caConfigured = true;
    } else {
      console.warn(`[DB CONFIG WARNING] Configured DB_SSL_CA_PATH file not found at: ${caPathResolved}`);
    }
  }

  if (caConfigured && caBuffer) {
    sslConfig = {
      ca: caBuffer,
      rejectUnauthorized: true
    };
  } else if (process.env.DB_SSL === 'false') {
    sslConfig = false;
  } else if (process.env.DB_SSL === 'true' || databaseUrl || process.env.DB_HOST) {
    // Default SSL mode for Aiven / Cloud MySQL when no explicit CA file is specified
    sslConfig = { rejectUnauthorized: false };
  }

  if (databaseUrl) {
    return {
      connectionConfig: {
        uri: databaseUrl,
        ssl: sslConfig,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        multipleStatements: false
      },
      safeDiagnostics: {
        source: 'DATABASE_URL',
        sslEnabled: !!sslConfig,
        caConfigured
      }
    };
  }

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME;
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;

  return {
    connectionConfig: {
      host,
      user,
      password,
      database,
      port,
      ssl: sslConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: false
    },
    safeDiagnostics: {
      source: 'ENVIRONMENT_VARS',
      host: host || '(NOT SET)',
      port,
      user: user || '(NOT SET)',
      database: database || '(NOT SET)',
      sslEnabled: !!sslConfig,
      caConfigured
    }
  };
}

/**
 * Formats non-sensitive diagnostic info (without passwords or secrets)
 */
function getSafeDbDiagnostics() {
  const { safeDiagnostics } = getDbConfig();
  let host = safeDiagnostics.host;
  let port = safeDiagnostics.port;
  let user = safeDiagnostics.user;
  let database = safeDiagnostics.database;

  if (safeDiagnostics.source === 'DATABASE_URL' && process.env.DATABASE_URL) {
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      host = parsed.hostname;
      port = parsed.port || 3306;
      user = parsed.username;
      database = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
    } catch (e) {
      host = '(PARSED FROM DATABASE_URL)';
    }
  }

  return {
    host: host || '(NOT CONFIGURED)',
    port: port || 3306,
    user: user || '(NOT CONFIGURED)',
    database: database || '(NOT CONFIGURED)',
    sslEnabled: safeDiagnostics.sslEnabled ? 'YES' : 'NO',
    caConfigured: safeDiagnostics.caConfigured ? 'YES' : 'NO'
  };
}

const { connectionConfig } = getDbConfig();
const pool = mysql.createPool(connectionConfig);

// Test database connectivity on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL Database Connected Successfully (RaktOra Professional Upgrade Suite)');
    connection.release();
  } catch (err) {
    console.warn('MySQL Connection Warning:', err.message);
  }
})();

// Helper function to query a single row
async function queryOne(sql, params = []) {
  if (module.exports && module.exports.queryOne && module.exports.queryOne !== queryOne) {
    return module.exports.queryOne(sql, params);
  }
  const [rows] = await pool.execute(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper function to query multiple rows
async function query(sql, params = []) {
  if (module.exports && module.exports.query && module.exports.query !== query) {
    return module.exports.query(sql, params);
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Helper function for Insert/Update/Delete operations
async function execute(sql, params = []) {
  if (module.exports && module.exports.execute && module.exports.execute !== execute) {
    return module.exports.execute(sql, params);
  }
  const [result] = await pool.execute(sql, params);
  return result;
}

/**
 * Executes a callback within a managed MySQL transaction on a dedicated connection.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and connection release.
 *
 * @param {Function} callback - Async function receiving (connection)
 * @returns {Promise<any>} Result of callback
 */
async function withTransaction(callback) {
  if (module.exports && module.exports.withTransaction && module.exports.withTransaction !== withTransaction) {
    return module.exports.withTransaction(callback);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error('[DB ROLLBACK ERROR]:', rollbackErr.message);
    }
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  getDbConfig,
  getSafeDbDiagnostics,
  query,
  queryOne,
  execute,
  withTransaction
};
