const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getDbConfig, getSafeDbDiagnostics } = require('../backend/db');

async function runMigrations() {
  const diag = getSafeDbDiagnostics();
  const { connectionConfig } = getDbConfig();

  // Create dedicated migration connection configuration with isolated multipleStatements
  const migrationConfig = {
    ...connectionConfig,
    multipleStatements: true
  };

  console.log('--------------------------------------------------');
  console.log('RaktOra Database Migration Runner');
  console.log('--------------------------------------------------');
  console.log(`Target Host   : ${diag.host}:${diag.port}`);
  console.log(`Target DB     : ${diag.database}`);
  console.log(`Target User   : ${diag.user}`);
  console.log(`SSL Enabled   : ${diag.sslEnabled}`);
  console.log(`CA Configured : ${diag.caConfigured}`);
  console.log('--------------------------------------------------\n');

  let connection;
  try {
    connection = await mysql.createConnection(migrationConfig);

    // 1. Ensure schema_migrations tracking table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. Fetch set of already executed migration names
    const [rows] = await connection.query('SELECT migration_name FROM schema_migrations');
    const executedMigrations = new Set(rows.map(r => r.migration_name));

    // 3. Scan database/migrations directory for .sql files
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found in database/migrations.');
      return;
    }

    let appliedCount = 0;

    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`[SKIP] Migration already applied: ${file}`);
        continue;
      }

      console.log(`[RUNNING] Executing migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      if (!sql.trim()) {
        console.log(`[SKIP] Empty migration file: ${file}`);
        await connection.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file]);
        continue;
      }

      try {
        // Execute SQL statements using multipleStatements enabled pool
        await connection.query(sql);
      } catch (sqlErr) {
        // Safe check if error is duplicate column/index during sync migration
        const isDuplicateErr = sqlErr.code === 'ER_DUP_FIELDNAME' || sqlErr.errno === 1060 ||
                               sqlErr.code === 'ER_DUP_KEYNAME' || sqlErr.errno === 1061 ||
                               sqlErr.code === 'ER_TABLE_EXISTS_ERROR' || sqlErr.errno === 1050;

        if (!isDuplicateErr) {
          console.error(`\n❌ [MIGRATION FAILED] Error executing ${file}:`);
          console.error(sqlErr.message);
          process.exit(1);
        } else {
          console.log(`  [NOTE] Pre-existing schema element encountered in ${file} (${sqlErr.message}). Continuing.`);
        }
      }

      // Record migration execution
      await connection.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file]);
      console.log(`✅ [SUCCESS] Applied migration: ${file}\n`);
      appliedCount++;
    }

    console.log('--------------------------------------------------');
    console.log(`MIGRATION SUMMARY: ${appliedCount} new migration(s) applied successfully.`);
    console.log('Database is up to date!');
    console.log('--------------------------------------------------');

  } catch (err) {
    console.error('\n❌ [MIGRATION SYSTEM ERROR]:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch (endErr) {
        // ignore cleanup error
      }
    }
    process.exit(0);
  }
}

runMigrations();
