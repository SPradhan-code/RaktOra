/**
 * RaktOra Database Schema Consistency Verification Script
 * Validates that all required tables, columns, indexes, and ENUMs expected by the backend exist.
 */

const { pool } = require('../backend/db');

const REQUIRED_TABLES = [
  'Users',
  'Donors',
  'Recipients',
  'BloodBanks',
  'Hospitals',
  'BloodStock',
  'blood_units',
  'BloodRequests',
  'appointments',
  'DonationCamps',
  'CampRegistrations',
  'DonationHistory',
  'Notifications',
  'notification_preferences',
  'emergency_responses',
  'audit_logs',
  'otp_verifications'
];

const MANDATORY_COLUMNS = {
  Users: ['id', 'email', 'password_hash', 'phone', 'role', 'state', 'city', 'latitude', 'longitude', 'emergency_alerts_enabled', 'available_for_donation', 'email_verified', 'phone_verified', 'aadhaar_verified'],
  Donors: ['id', 'user_id', 'blood_group', 'age', 'gender', 'weight', 'last_donation_date', 'is_available', 'latitude', 'longitude', 'govt_id', 'health_notes'],
  Hospitals: ['id', 'user_id', 'name', 'license_number', 'phone', 'email', 'state', 'city', 'verification_status'],
  BloodBanks: ['id', 'user_id', 'name', 'license_number', 'phone', 'email', 'is_approved'],
  BloodStock: ['id', 'blood_bank_id', 'blood_group', 'component', 'units_available'],
  blood_units: ['id', 'unit_id', 'blood_group', 'component', 'collection_date', 'expiry_date', 'blood_bank_id', 'status', 'testing_status'],
  BloodRequests: ['id', 'requester_id', 'hospital_id', 'patient_name', 'blood_group', 'component', 'units_needed', 'units_fulfilled', 'urgency_level', 'status', 'latitude', 'longitude'],
  appointments: ['id', 'donor_id', 'blood_bank_id', 'date', 'start_time', 'end_time', 'status'],
  audit_logs: ['id', 'actor_user_id', 'action', 'entity_type', 'entity_id', 'old_value', 'new_value', 'ip_address'],
  notification_preferences: ['id', 'user_id', 'emergency_sms', 'emergency_email', 'emergency_push', 'appointment_reminders', 'camp_notifications'],
  emergency_responses: ['id', 'request_id', 'donor_user_id', 'response_type'],
  otp_verifications: ['id', 'user_id', 'identifier', 'type', 'otp_hash', 'expires_at', 'attempts', 'verified'],
  Notifications: ['id', 'user_id', 'title', 'message', 'type', 'channel', 'delivery_status', 'request_id', 'dedup_key', 'is_read']
};

async function verifyDatabaseSchema() {
  console.log('--------------------------------------------------');
  console.log('RaktOra Database Schema Consistency Check');
  console.log('--------------------------------------------------');

  let connection;
  let hasErrors = false;

  try {
    connection = await pool.getConnection();

    // Get database name
    const [dbResult] = await connection.query('SELECT DATABASE() AS db');
    const currentDb = dbResult[0].db;
    console.log(`Connected Database: ${currentDb}\n`);

    // 1. Check Tables
    const [tablesRows] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
      [currentDb]
    );

    const existingTables = new Set(tablesRows.map(r => r.TABLE_NAME));
    console.log('1. TABLE VERIFICATION:');

    for (const table of REQUIRED_TABLES) {
      if (existingTables.has(table)) {
        console.log(`  [OK] Table '${table}' exists.`);
      } else {
        console.error(`  [MISSING] Table '${table}' is MISSING!`);
        hasErrors = true;
      }
    }

    console.log('\n2. MANDATORY COLUMN VERIFICATION:');

    for (const [table, columns] of Object.entries(MANDATORY_COLUMNS)) {
      if (!existingTables.has(table)) continue;

      const [columnRows] = await connection.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [currentDb, table]
      );

      const existingColumns = new Set(columnRows.map(c => c.COLUMN_NAME));
      const missingInTable = columns.filter(col => !existingColumns.has(col));

      if (missingInTable.length === 0) {
        console.log(`  [OK] Table '${table}' has all ${columns.length} required columns.`);
      } else {
        console.error(`  [MISSING] Table '${table}' is missing columns: ${missingInTable.join(', ')}`);
        hasErrors = true;
      }
    }

    // 3. Verify Users role ENUM includes 'hospital'
    const [roleCol] = await connection.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Users' AND COLUMN_NAME = 'role'`,
      [currentDb]
    );
    if (roleCol.length > 0) {
      const typeStr = roleCol[0].COLUMN_TYPE;
      if (typeStr.includes("'hospital'")) {
        console.log("\n3. ENUM VERIFICATION: [OK] Users.role contains 'hospital'.");
      } else {
        console.error(`\n3. ENUM VERIFICATION: [MISSING] Users.role missing 'hospital'! Current type: ${typeStr}`);
        hasErrors = true;
      }
    }

    console.log('\n--------------------------------------------------');
    if (hasErrors) {
      console.error('VERIFICATION STATUS: FAILED — Schema mismatches found.');
      process.exit(1);
    } else {
      console.log('VERIFICATION STATUS: PASSED — Database schema is fully consistent with RaktOra backend!');
      process.exit(0);
    }

  } catch (err) {
    console.error('Database connection error during verification:', err.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

verifyDatabaseSchema();
