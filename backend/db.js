const mysql = require('mysql2/promise');
require('dotenv').config();

// Create MySQL Connection Pool (Compatible with Aiven MySQL, Render & Local DB)
const connectionConfig = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'bloodconnect_db',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true
    };

const pool = mysql.createPool(connectionConfig);

// Test connection and run automated schema migrations on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL Database Connected Successfully (RaktOra Professional Upgrade Suite)');

    // 1. Alter Users role ENUM to include 'hospital'
    try {
      await connection.query(`
        ALTER TABLE Users MODIFY COLUMN role ENUM('donor', 'recipient', 'blood_bank', 'hospital', 'admin') NOT NULL DEFAULT 'donor'
      `);
    } catch (e) {}

    // 2. Add lat/lng & privacy columns to Users and Donors
    for (const table of ['Users', 'Donors']) {
      try {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN latitude DECIMAL(10, 7) NULL`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN longitude DECIMAL(10, 7) NULL`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN emergency_alerts_enabled TINYINT(1) NOT NULL DEFAULT 1`);
      } catch (e) {}
      try {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN available_for_donation TINYINT(1) NOT NULL DEFAULT 1`);
      } catch (e) {}
    }

    // 3. Ensure Donors table has govt_id and health_notes
    try {
      await connection.query('ALTER TABLE Donors ADD COLUMN govt_id VARCHAR(255) NULL');
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE Donors ADD COLUMN health_notes TEXT NULL');
    } catch (e) {}

    // 4. Ensure Users table has verification flag & DigiLocker columns
    const userColumns = [
      'email_verified', 'phone_verified', 'aadhaar_verified', 
      'email_verified_at', 'phone_verified_at', 'aadhaar_verified_at',
      'digilocker_verified', 'digilocker_verified_at', 'verification_provider', 'verification_reference'
    ];
    for (const col of userColumns) {
      try {
        if (col.endsWith('_at')) {
          await connection.query(`ALTER TABLE Users ADD COLUMN ${col} DATETIME NULL`);
        } else if (col.startsWith('verification_')) {
          await connection.query(`ALTER TABLE Users ADD COLUMN ${col} VARCHAR(150) NULL`);
        } else {
          await connection.query(`ALTER TABLE Users ADD COLUMN ${col} TINYINT(1) NOT NULL DEFAULT 0`);
        }
      } catch (e) {}
    }

    // 5. Create Hospitals table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS Hospitals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        license_number VARCHAR(50) NOT NULL UNIQUE,
        contact_person VARCHAR(100),
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(100),
        state VARCHAR(50) NOT NULL,
        city VARCHAR(50) NOT NULL,
        full_address TEXT NOT NULL,
        pincode VARCHAR(10),
        latitude DECIMAL(10, 7) NULL,
        longitude DECIMAL(10, 7) NULL,
        verification_status ENUM('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING_VERIFICATION',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_hospitals_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
        INDEX idx_hospitals_license (license_number),
        INDEX idx_hospitals_status (verification_status),
        INDEX idx_hospitals_location (state, city)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 6. Ensure BloodStock has component column
    try {
      await connection.query(`
        ALTER TABLE BloodStock ADD COLUMN component ENUM('WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP') NOT NULL DEFAULT 'WHOLE_BLOOD'
      `);
    } catch (e) {}

    // 7. Create blood_units table & extend status & testing columns
    await connection.query(`
      CREATE TABLE IF NOT EXISTS blood_units (
        id INT AUTO_INCREMENT PRIMARY KEY,
        unit_id VARCHAR(50) NOT NULL UNIQUE,
        blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
        component ENUM('WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP') NOT NULL DEFAULT 'WHOLE_BLOOD',
        collection_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        blood_bank_id INT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
        testing_status ENUM('PENDING', 'PASSED', 'FAILED') NOT NULL DEFAULT 'PASSED',
        donation_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_units_bank FOREIGN KEY (blood_bank_id) REFERENCES BloodBanks(id) ON DELETE CASCADE,
        INDEX idx_units_search (blood_bank_id, blood_group, component, status),
        INDEX idx_units_expiry (expiry_date, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    try {
      await connection.query("ALTER TABLE blood_units ADD COLUMN testing_status ENUM('PENDING', 'PASSED', 'FAILED') NOT NULL DEFAULT 'PASSED'");
    } catch (e) {}

    // 8. Create appointments table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        donor_id INT NOT NULL,
        blood_bank_id INT NOT NULL,
        date DATE NOT NULL,
        start_time VARCHAR(20) NOT NULL,
        end_time VARCHAR(20) NOT NULL,
        status ENUM('BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW') NOT NULL DEFAULT 'BOOKED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_appt_donor FOREIGN KEY (donor_id) REFERENCES Donors(id) ON DELETE CASCADE,
        CONSTRAINT fk_appt_bank FOREIGN KEY (blood_bank_id) REFERENCES BloodBanks(id) ON DELETE CASCADE,
        INDEX idx_appt_donor (donor_id),
        INDEX idx_appt_bank_date (blood_bank_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 9. Create audit_logs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor_user_id INT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT NULL,
        old_value JSON NULL,
        new_value JSON NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_actor (actor_user_id),
        INDEX idx_audit_action (action),
        INDEX idx_audit_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 10. Create notification_preferences table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        emergency_sms TINYINT(1) NOT NULL DEFAULT 1,
        emergency_email TINYINT(1) NOT NULL DEFAULT 1,
        emergency_push TINYINT(1) NOT NULL DEFAULT 1,
        appointment_reminders TINYINT(1) NOT NULL DEFAULT 1,
        camp_notifications TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_notif_pref_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 11. Create emergency_responses table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS emergency_responses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        donor_user_id INT NOT NULL,
        response_type ENUM('PLEDGED', 'ATTENDED', 'DECLINED') NOT NULL DEFAULT 'PLEDGED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_em_resp_req FOREIGN KEY (request_id) REFERENCES BloodRequests(id) ON DELETE CASCADE,
        CONSTRAINT fk_em_resp_donor FOREIGN KEY (donor_user_id) REFERENCES Users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 12. Extend BloodRequests & Notifications
    try {
      await connection.query('ALTER TABLE BloodRequests ADD COLUMN hospital_id INT NULL');
    } catch (e) {}
    try {
      await connection.query("ALTER TABLE BloodRequests ADD COLUMN component ENUM('WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP') NOT NULL DEFAULT 'WHOLE_BLOOD'");
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE BloodRequests ADD COLUMN latitude DECIMAL(10, 7) NULL');
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE BloodRequests ADD COLUMN longitude DECIMAL(10, 7) NULL');
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE BloodRequests ADD COLUMN status_reason VARCHAR(255) NULL');
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE BloodRequests ADD COLUMN approved_by INT NULL');
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE BloodRequests ADD COLUMN approved_at DATETIME NULL');
    } catch (e) {}

    // Index for duplicate check on BloodRequests
    try {
      await connection.query('CREATE INDEX idx_req_dup_check ON BloodRequests (hospital_id, blood_group, component, status)');
    } catch (e) {}

    // Notifications extensions
    try {
      await connection.query("ALTER TABLE Notifications ADD COLUMN channel ENUM('In-App', 'Email', 'SMS', 'Push') NOT NULL DEFAULT 'In-App'");
    } catch (e) {}
    try {
      await connection.query("ALTER TABLE Notifications ADD COLUMN delivery_status ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'SENT'");
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE Notifications ADD COLUMN request_id INT NULL');
    } catch (e) {}
    try {
      await connection.query('ALTER TABLE Notifications ADD COLUMN dedup_key VARCHAR(150) NULL');
    } catch (e) {}
    try {
      await connection.query('CREATE INDEX idx_notif_dedup ON Notifications (user_id, dedup_key)');
    } catch (e) {}

    // 13. Ensure otp_verifications table exists and has all backward-compatible columns (identifier, email, phone)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        identifier VARCHAR(150) NULL,
        email VARCHAR(150) NULL,
        phone VARCHAR(150) NULL,
        type ENUM('email', 'phone') NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        verified TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_at DATETIME NULL,
        INDEX idx_otp_identifier_type (identifier, type),
        INDEX idx_otp_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure columns identifier, email, phone exist on otp_verifications regardless of when table was created
    try { await connection.query('ALTER TABLE otp_verifications ADD COLUMN identifier VARCHAR(150) NULL'); } catch (e) {}
    try { await connection.query('ALTER TABLE otp_verifications ADD COLUMN email VARCHAR(150) NULL'); } catch (e) {}
    try { await connection.query('ALTER TABLE otp_verifications ADD COLUMN phone VARCHAR(150) NULL'); } catch (e) {}
    try { await connection.query('ALTER TABLE Users ADD COLUMN email VARCHAR(100) NULL'); } catch (e) {}

    connection.release();
  } catch (err) {
    console.warn('MySQL Connection Warning:', err.message);
  }
})();

// Helper function to query a single row
async function queryOne(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper function to query multiple rows
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Helper function for Insert/Update/Delete operations
async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

module.exports = {
  pool,
  query,
  queryOne,
  execute
};
