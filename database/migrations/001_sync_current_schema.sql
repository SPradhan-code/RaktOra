-- ============================================================================
-- RaktOra / BloodConnect - Production-Safe Database Schema Synchronization
-- Migration File: database/migrations/001_sync_current_schema.sql
-- Compatible with: MySQL 5.7+ / MySQL 8.0+ / Aiven MySQL / MariaDB 10.3+
-- Absolute Safety Guarantees:
--   1. NO DROP TABLE, NO DROP DATABASE, NO TRUNCATE, NO DELETE FROM.
--   2. NO AUTOMATIC MODIFICATION OR DELETION OF EXISTING APPLICATION RECORDS.
--   3. Checks Users.role ENUM before modification to protect existing roles.
--   4. Checks BloodRequests.status data type before converting ENUM to VARCHAR(50).
--   5. Checks for orphan records BEFORE attempting Foreign Key additions. Skips FK if orphans exist.
--   6. 100% Idempotent execution (can be run safely multiple times).
-- ============================================================================

DELIMITER //

-- Helper Procedure 1: Safe Column Addition
DROP PROCEDURE IF EXISTS raktora_add_column_if_not_exists //
CREATE PROCEDURE raktora_add_column_if_not_exists(
    IN p_table VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_datatype TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table
    ) AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = p_table 
          AND COLUMN_NAME = p_column
    ) THEN
        SET @stmt_sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_datatype);
        PREPARE stmt FROM @stmt_sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

-- Helper Procedure 2: Safe Users.role ENUM Expansion
DROP PROCEDURE IF EXISTS raktora_expand_user_role_enum //
CREATE PROCEDURE raktora_expand_user_role_enum()
BEGIN
    DECLARE v_enum_type TEXT;
    
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users'
    ) THEN
        SELECT COLUMN_TYPE INTO v_enum_type 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'Users' 
          AND COLUMN_NAME = 'role';

        IF v_enum_type IS NOT NULL AND INSTR(v_enum_type, "'hospital'") = 0 THEN
            ALTER TABLE Users MODIFY COLUMN role ENUM('donor', 'recipient', 'blood_bank', 'hospital', 'admin') NOT NULL DEFAULT 'donor';
        END IF;
    END IF;
END //

-- Helper Procedure 3: Safe BloodRequests.status Column Expansion
DROP PROCEDURE IF EXISTS raktora_expand_request_status //
CREATE PROCEDURE raktora_expand_request_status()
BEGIN
    DECLARE v_data_type VARCHAR(64);
    
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BloodRequests'
    ) THEN
        SELECT DATA_TYPE INTO v_data_type
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'BloodRequests'
          AND COLUMN_NAME = 'status';

        IF v_data_type IS NOT NULL AND v_data_type = 'enum' THEN
            ALTER TABLE BloodRequests MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Pending';
        END IF;
    END IF;
END //

-- Helper Procedure 4: Safe Index Addition
DROP PROCEDURE IF EXISTS raktora_add_index_if_not_exists //
CREATE PROCEDURE raktora_add_index_if_not_exists(
    IN p_table VARCHAR(64),
    IN p_index VARCHAR(64),
    IN p_columns TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table
    ) AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = p_table 
          AND INDEX_NAME = p_index
    ) THEN
        SET @stmt_sql = CONCAT('CREATE INDEX `', p_index, '` ON `', p_table, '` (', p_columns, ')');
        PREPARE stmt FROM @stmt_sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

-- Helper Procedure 5: Non-Destructive Foreign Key Addition (No automatic UPDATE or DELETE)
DROP PROCEDURE IF EXISTS raktora_add_foreign_key_if_not_exists //
CREATE PROCEDURE raktora_add_foreign_key_if_not_exists(
    IN p_table VARCHAR(64),
    IN p_constraint VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_ref_table VARCHAR(64),
    IN p_ref_column VARCHAR(64),
    IN p_on_delete VARCHAR(32)
)
BEGIN
    DECLARE v_orphan_count INT DEFAULT 0;

    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = p_table 
          AND CONSTRAINT_NAME = p_constraint
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        -- Verify both table and referenced table exist
        IF EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table
        ) AND EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_ref_table
        ) THEN
            -- Check for orphan records without modifying existing data
            SET @orphan_check_sql = CONCAT(
                'SELECT COUNT(*) INTO @v_orphan_count ',
                'FROM `', p_table, '` t ',
                'LEFT JOIN `', p_ref_table, '` r ON t.`', p_column, '` = r.`', p_ref_column, '` ',
                'WHERE t.`', p_column, '` IS NOT NULL AND r.`', p_ref_column, '` IS NULL'
            );
            PREPARE stmt_check FROM @orphan_check_sql;
            EXECUTE stmt_check;
            DEALLOCATE PREPARE stmt_check;

            -- Add FK constraint ONLY if no orphan records exist
            IF @v_orphan_count = 0 THEN
                SET @fk_sql = CONCAT(
                    'ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_constraint, '` ',
                    'FOREIGN KEY (`', p_column, '`) REFERENCES `', p_ref_table, '`(`', p_ref_column, '`) ',
                    'ON DELETE ', p_on_delete
                );
                PREPARE stmt_fk FROM @fk_sql;
                EXECUTE stmt_fk;
                DEALLOCATE PREPARE stmt_fk;
            END IF;
        END IF;
    END IF;
END //

DELIMITER ;

-- ============================================================================
-- STEP 1: Safe ENUM & Column Type Expansions
-- ============================================================================

-- Expand Users.role ENUM to include 'hospital' without affecting existing user roles
CALL raktora_expand_user_role_enum();

-- Expand BloodRequests.status from ENUM to VARCHAR(50) to support new workflow states safely
CALL raktora_expand_request_status();

-- ============================================================================
-- STEP 2: Safe Column Additions to Existing Core Tables
-- ============================================================================

-- Table: Users
CALL raktora_add_column_if_not_exists('Users', 'latitude', 'DECIMAL(10, 7) NULL');
CALL raktora_add_column_if_not_exists('Users', 'longitude', 'DECIMAL(10, 7) NULL');
CALL raktora_add_column_if_not_exists('Users', 'emergency_alerts_enabled', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL raktora_add_column_if_not_exists('Users', 'available_for_donation', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL raktora_add_column_if_not_exists('Users', 'email_verified', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL raktora_add_column_if_not_exists('Users', 'phone_verified', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL raktora_add_column_if_not_exists('Users', 'aadhaar_verified', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL raktora_add_column_if_not_exists('Users', 'email_verified_at', 'DATETIME NULL');
CALL raktora_add_column_if_not_exists('Users', 'phone_verified_at', 'DATETIME NULL');
CALL raktora_add_column_if_not_exists('Users', 'aadhaar_verified_at', 'DATETIME NULL');

-- Table: Donors
CALL raktora_add_column_if_not_exists('Donors', 'latitude', 'DECIMAL(10, 7) NULL');
CALL raktora_add_column_if_not_exists('Donors', 'longitude', 'DECIMAL(10, 7) NULL');
CALL raktora_add_column_if_not_exists('Donors', 'emergency_alerts_enabled', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL raktora_add_column_if_not_exists('Donors', 'available_for_donation', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL raktora_add_column_if_not_exists('Donors', 'govt_id', 'VARCHAR(255) NULL');
CALL raktora_add_column_if_not_exists('Donors', 'health_notes', 'TEXT NULL');

-- Table: BloodStock
CALL raktora_add_column_if_not_exists('BloodStock', 'component', "ENUM('WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP') NOT NULL DEFAULT 'WHOLE_BLOOD'");

-- Table: BloodRequests
CALL raktora_add_column_if_not_exists('BloodRequests', 'hospital_id', 'INT NULL');
CALL raktora_add_column_if_not_exists('BloodRequests', 'component', "ENUM('WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP') NOT NULL DEFAULT 'WHOLE_BLOOD'");
CALL raktora_add_column_if_not_exists('BloodRequests', 'latitude', 'DECIMAL(10, 7) NULL');
CALL raktora_add_column_if_not_exists('BloodRequests', 'longitude', 'DECIMAL(10, 7) NULL');
CALL raktora_add_column_if_not_exists('BloodRequests', 'status_reason', 'VARCHAR(255) NULL');
CALL raktora_add_column_if_not_exists('BloodRequests', 'approved_by', 'INT NULL');
CALL raktora_add_column_if_not_exists('BloodRequests', 'approved_at', 'DATETIME NULL');

-- Table: Notifications
CALL raktora_add_column_if_not_exists('Notifications', 'channel', "ENUM('In-App', 'Email', 'SMS', 'Push') NOT NULL DEFAULT 'In-App'");
CALL raktora_add_column_if_not_exists('Notifications', 'delivery_status', "ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'SENT'");
CALL raktora_add_column_if_not_exists('Notifications', 'request_id', 'INT NULL');
CALL raktora_add_column_if_not_exists('Notifications', 'dedup_key', 'VARCHAR(150) NULL');

-- ============================================================================
-- STEP 3: Create Missing Tables (Safe CREATE TABLE IF NOT EXISTS)
-- ============================================================================

-- Table 1: Hospitals
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: blood_units
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 3: appointments
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 4: audit_logs
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
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES Users(id) ON DELETE SET NULL,
  INDEX idx_audit_actor (actor_user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 5: notification_preferences
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 6: emergency_responses
CREATE TABLE IF NOT EXISTS emergency_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  donor_user_id INT NOT NULL,
  response_type ENUM('PLEDGED', 'ATTENDED', 'DECLINED') NOT NULL DEFAULT 'PLEDGED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_em_resp_req FOREIGN KEY (request_id) REFERENCES BloodRequests(id) ON DELETE CASCADE,
  CONSTRAINT fk_em_resp_donor FOREIGN KEY (donor_user_id) REFERENCES Users(id) ON DELETE CASCADE,
  INDEX idx_em_resp_req (request_id),
  INDEX idx_em_resp_donor (donor_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 7: otp_verifications
CREATE TABLE IF NOT EXISTS otp_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  identifier VARCHAR(150) NOT NULL,
  type ENUM('email', 'phone') NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME NULL,
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
  INDEX idx_otp_identifier_type (identifier, type),
  INDEX idx_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- STEP 4: Add Missing Indexes Safely
-- ============================================================================

CALL raktora_add_index_if_not_exists('BloodRequests', 'idx_req_dup_check', 'hospital_id, blood_group, component, status');
CALL raktora_add_index_if_not_exists('BloodRequests', 'idx_requests_hospital_id', 'hospital_id');
CALL raktora_add_index_if_not_exists('BloodRequests', 'idx_requests_component', 'component');
CALL raktora_add_index_if_not_exists('Notifications', 'idx_notif_dedup', 'user_id, dedup_key');
CALL raktora_add_index_if_not_exists('Notifications', 'idx_notif_request_id', 'request_id');
CALL raktora_add_index_if_not_exists('BloodStock', 'idx_bloodstock_bank_group_comp', 'blood_bank_id, blood_group, component');

-- ============================================================================
-- STEP 5: Add Foreign Key Constraints Safely (Non-Destructive)
-- ============================================================================

CALL raktora_add_foreign_key_if_not_exists('BloodRequests', 'fk_requests_hospital', 'hospital_id', 'Hospitals', 'id', 'SET NULL');
CALL raktora_add_foreign_key_if_not_exists('Notifications', 'fk_notifications_request', 'request_id', 'BloodRequests', 'id', 'SET NULL');

-- ============================================================================
-- STEP 6: Clean Up Migration Helper Procedures
-- ============================================================================

DROP PROCEDURE IF EXISTS raktora_add_column_if_not_exists;
DROP PROCEDURE IF EXISTS raktora_expand_user_role_enum;
DROP PROCEDURE IF EXISTS raktora_expand_request_status;
DROP PROCEDURE IF EXISTS raktora_add_index_if_not_exists;
DROP PROCEDURE IF EXISTS raktora_add_foreign_key_if_not_exists;

-- ============================================================================
-- END OF FINAL REVISED MIGRATION 001_sync_current_schema.sql
-- ============================================================================
