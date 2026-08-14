-- ============================================================================
-- RaktOra / BloodConnect - Blood Donor Management & Emergency Dispatch System
-- Complete Relational Database Schema (CURRENT Production Standard)
-- Compatible with MySQL 5.7+ / MySQL 8.0+ / Aiven MySQL / MariaDB 10.3+
-- Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS otp_verifications;
DROP TABLE IF EXISTS emergency_responses;
DROP TABLE IF EXISTS notification_preferences;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS blood_units;
DROP TABLE IF EXISTS Notifications;
DROP TABLE IF EXISTS DonationHistory;
DROP TABLE IF EXISTS CampRegistrations;
DROP TABLE IF EXISTS DonationCamps;
DROP TABLE IF EXISTS BloodRequests;
DROP TABLE IF EXISTS BloodStock;
DROP TABLE IF EXISTS Hospitals;
DROP TABLE IF EXISTS BloodBanks;
DROP TABLE IF EXISTS Recipients;
DROP TABLE IF EXISTS Donors;
DROP TABLE IF EXISTS Users;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. Users Table (Core Authentication & Role Management)
-- ============================================================================
CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role ENUM('donor', 'recipient', 'blood_bank', 'hospital', 'admin') NOT NULL DEFAULT 'donor',
    state VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    pincode VARCHAR(10),
    is_verified TINYINT(1) NOT NULL DEFAULT 1,
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    phone_verified TINYINT(1) NOT NULL DEFAULT 0,
    aadhaar_verified TINYINT(1) NOT NULL DEFAULT 0,
    email_verified_at DATETIME NULL,
    phone_verified_at DATETIME NULL,
    aadhaar_verified_at DATETIME NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    emergency_alerts_enabled TINYINT(1) NOT NULL DEFAULT 1,
    available_for_donation TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_location (state, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. Donors Table (Voluntary Donor Profiles)
-- ============================================================================
CREATE TABLE Donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    age INT NOT NULL CHECK (age >= 18 AND age <= 65),
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    weight DECIMAL(5,2) CHECK (weight >= 45.0),
    last_donation_date DATE,
    is_available TINYINT(1) NOT NULL DEFAULT 1,
    available_for_donation TINYINT(1) NOT NULL DEFAULT 1,
    emergency_alerts_enabled TINYINT(1) NOT NULL DEFAULT 1,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    address TEXT,
    profile_pic VARCHAR(255),
    total_donations INT NOT NULL DEFAULT 0,
    govt_id VARCHAR(255) NULL,
    health_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_donors_user FOREIGN KEY (user_id) 
        REFERENCES Users(id) ON DELETE CASCADE,
        
    INDEX idx_donors_blood_group (blood_group),
    INDEX idx_donors_available (is_available),
    INDEX idx_donors_search (blood_group, is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. Recipients Table (Patient/Recipient Profiles)
-- ============================================================================
CREATE TABLE Recipients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    emergency_contact VARCHAR(20),
    relationship_to_patient VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_recipients_user FOREIGN KEY (user_id) 
        REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. BloodBanks Table (Accredited Blood Centers)
-- ============================================================================
CREATE TABLE BloodBanks (
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
    operating_hours VARCHAR(100) DEFAULT '24/7',
    is_approved TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_bloodbanks_user FOREIGN KEY (user_id) 
        REFERENCES Users(id) ON DELETE CASCADE,
        
    INDEX idx_bloodbanks_license (license_number),
    INDEX idx_bloodbanks_location (state, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. Hospitals Table (Registered Medical Facilities)
-- ============================================================================
CREATE TABLE Hospitals (
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
  
  CONSTRAINT fk_hospitals_user FOREIGN KEY (user_id) 
      REFERENCES Users(id) ON DELETE CASCADE,
      
  INDEX idx_hospitals_license (license_number),
  INDEX idx_hospitals_status (verification_status),
  INDEX idx_hospitals_location (state, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. BloodStock Table (Live Inventory Matrix per Blood Center)
-- ============================================================================
CREATE TABLE BloodStock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blood_bank_id INT NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    component ENUM('WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP') NOT NULL DEFAULT 'WHOLE_BLOOD',
    units_available INT NOT NULL DEFAULT 0 CHECK (units_available >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY bank_blood_group_comp (blood_bank_id, blood_group, component),
    
    CONSTRAINT fk_bloodstock_bank FOREIGN KEY (blood_bank_id) 
        REFERENCES BloodBanks(id) ON DELETE CASCADE,
        
    INDEX idx_bloodstock_group_units (blood_group, units_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. blood_units Table (Individual Unit Tracking & FEFO)
-- ============================================================================
CREATE TABLE blood_units (
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
  
  CONSTRAINT fk_units_bank FOREIGN KEY (blood_bank_id) 
      REFERENCES BloodBanks(id) ON DELETE CASCADE,
      
  INDEX idx_units_search (blood_bank_id, blood_group, component, status),
  INDEX idx_units_expiry (expiry_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. BloodRequests Table (Emergency SOS & Hospital Requests)
-- ============================================================================
CREATE TABLE BloodRequests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requester_id INT NOT NULL,
    hospital_id INT NULL,
    patient_name VARCHAR(100) NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    component ENUM('WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP') NOT NULL DEFAULT 'WHOLE_BLOOD',
    units_needed INT NOT NULL DEFAULT 1 CHECK (units_needed > 0),
    units_fulfilled INT NOT NULL DEFAULT 0 CHECK (units_fulfilled >= 0),
    hospital_name VARCHAR(150) NOT NULL,
    hospital_address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    urgency_level ENUM('Standard', 'Urgent', 'Critical') NOT NULL DEFAULT 'Urgent',
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    status_reason VARCHAR(255) NULL,
    approved_by INT NULL,
    approved_at DATETIME NULL,
    contact_number VARCHAR(20) NOT NULL,
    required_by_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_requests_requester FOREIGN KEY (requester_id) 
        REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_requests_hospital FOREIGN KEY (hospital_id)
        REFERENCES Hospitals(id) ON DELETE SET NULL,
        
    INDEX idx_requests_status (status),
    INDEX idx_requests_urgency (urgency_level),
    INDEX idx_requests_search (blood_group, status, state, city),
    INDEX idx_req_dup_check (hospital_id, blood_group, component, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. appointments Table (Voluntary Donation Appointments)
-- ============================================================================
CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  blood_bank_id INT NOT NULL,
  date DATE NOT NULL,
  start_time VARCHAR(20) NOT NULL,
  end_time VARCHAR(20) NOT NULL,
  status ENUM('BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW') NOT NULL DEFAULT 'BOOKED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_appt_donor FOREIGN KEY (donor_id) 
      REFERENCES Donors(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_bank FOREIGN KEY (blood_bank_id) 
      REFERENCES BloodBanks(id) ON DELETE CASCADE,
      
  INDEX idx_appt_donor (donor_id),
  INDEX idx_appt_bank_date (blood_bank_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. DonationCamps Table (Voluntary Blood Donation Drives)
-- ============================================================================
CREATE TABLE DonationCamps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blood_bank_id INT NULL,
    organizer_name VARCHAR(100) NOT NULL,
    camp_title VARCHAR(150) NOT NULL,
    date DATE NOT NULL,
    time_start VARCHAR(20) NOT NULL,
    time_end VARCHAR(20) NOT NULL,
    venue_address TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    state VARCHAR(50) NOT NULL,
    expected_donors INT DEFAULT 100 CHECK (expected_donors > 0),
    registered_count INT DEFAULT 0 CHECK (registered_count >= 0),
    status ENUM('Upcoming', 'Ongoing', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_camps_bank FOREIGN KEY (blood_bank_id) 
        REFERENCES BloodBanks(id) ON DELETE SET NULL,
        
    INDEX idx_camps_date (date),
    INDEX idx_camps_status (status),
    INDEX idx_camps_location (state, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. CampRegistrations Table (Junction: Donor Registrations at Camps)
-- ============================================================================
CREATE TABLE CampRegistrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    camp_id INT NOT NULL,
    donor_user_id INT NOT NULL,
    status ENUM('Registered', 'Attended', 'Cancelled') NOT NULL DEFAULT 'Registered',
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY camp_donor_unique (camp_id, donor_user_id),
    
    CONSTRAINT fk_camp_reg_camp FOREIGN KEY (camp_id) 
        REFERENCES DonationCamps(id) ON DELETE CASCADE,
    CONSTRAINT fk_camp_reg_donor FOREIGN KEY (donor_user_id) 
        REFERENCES Users(id) ON DELETE CASCADE,
        
    INDEX idx_camp_reg_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. DonationHistory Table (Completed Blood Donation Ledger)
-- ============================================================================
CREATE TABLE DonationHistory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id INT NOT NULL,
    blood_bank_id INT NULL,
    camp_id INT NULL,
    units_donated INT NOT NULL DEFAULT 1,
    donation_date DATE NOT NULL,
    certificate_code VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_donations_donor FOREIGN KEY (donor_id) 
        REFERENCES Donors(id) ON DELETE CASCADE,
    CONSTRAINT fk_donations_bank FOREIGN KEY (blood_bank_id) 
        REFERENCES BloodBanks(id) ON DELETE SET NULL,
    CONSTRAINT fk_donations_camp FOREIGN KEY (camp_id) 
        REFERENCES DonationCamps(id) ON DELETE SET NULL,
        
    INDEX idx_donations_date (donation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 13. Notifications Table (User Alerts & System Broadcasting)
-- ============================================================================
CREATE TABLE Notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('request', 'alert', 'info', 'camp') NOT NULL DEFAULT 'info',
    channel ENUM('In-App', 'Email', 'SMS', 'Push') NOT NULL DEFAULT 'In-App',
    delivery_status ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'SENT',
    request_id INT NULL,
    dedup_key VARCHAR(150) NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) 
        REFERENCES Users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_request FOREIGN KEY (request_id)
        REFERENCES BloodRequests(id) ON DELETE SET NULL,
        
    INDEX idx_notifications_user_read (user_id, is_read),
    INDEX idx_notif_dedup (user_id, dedup_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 14. notification_preferences Table (User Notification Matrix)
-- ============================================================================
CREATE TABLE notification_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  emergency_sms TINYINT(1) NOT NULL DEFAULT 1,
  emergency_email TINYINT(1) NOT NULL DEFAULT 1,
  emergency_push TINYINT(1) NOT NULL DEFAULT 1,
  appointment_reminders TINYINT(1) NOT NULL DEFAULT 1,
  camp_notifications TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_notif_pref_user FOREIGN KEY (user_id) 
      REFERENCES Users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 15. emergency_responses Table (Donor Emergency Pledges)
-- ============================================================================
CREATE TABLE emergency_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  donor_user_id INT NOT NULL,
  response_type ENUM('PLEDGED', 'ATTENDED', 'DECLINED') NOT NULL DEFAULT 'PLEDGED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_em_resp_req FOREIGN KEY (request_id) 
      REFERENCES BloodRequests(id) ON DELETE CASCADE,
  CONSTRAINT fk_em_resp_donor FOREIGN KEY (donor_user_id) 
      REFERENCES Users(id) ON DELETE CASCADE,
      
  INDEX idx_em_resp_req (request_id),
  INDEX idx_em_resp_donor (donor_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 16. audit_logs Table (System Audit & Action Logging)
-- ============================================================================
CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) 
      REFERENCES Users(id) ON DELETE SET NULL,
      
  INDEX idx_audit_actor (actor_user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 17. otp_verifications Table (Secure OTP Verification Ledger)
-- ============================================================================
CREATE TABLE otp_verifications (
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
  
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) 
      REFERENCES Users(id) ON DELETE SET NULL,
      
  INDEX idx_otp_identifier_type (identifier, type),
  INDEX idx_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Sample Seed Data Insertion
-- ============================================================================

INSERT INTO Users (id, full_name, email, password_hash, phone, role, state, city, pincode, is_verified, email_verified, phone_verified) VALUES
(1, 'Admin System', 'admin@bloodconnect.org', '$2a$10$7R.x5V7c7GqS5.Y/Y1gUuekF/b6aA1k9i9k9i9k9i9k9i9k9i9k9i', '+91 1800111000', 'admin', 'Delhi', 'New Delhi', '110001', 1, 1, 1),
(2, 'Rahul Sharma', 'rahul@gmail.com', '$2a$10$7R.x5V7c7GqS5.Y/Y1gUuekF/b6aA1k9i9k9i9k9i9k9i9k9i9k9i', '+91 9876543210', 'donor', 'Maharashtra', 'Mumbai', '400001', 1, 1, 1),
(3, 'Ananya Verma', 'ananya@gmail.com', '$2a$10$7R.x5V7c7GqS5.Y/Y1gUuekF/b6aA1k9i9k9i9k9i9k9i9k9i9k9i', '+91 9812345678', 'donor', 'Karnataka', 'Bengaluru', '560001', 1, 1, 1),
(4, 'Rotary Blood Bank', 'rotary@bloodbanks.org', '$2a$10$7R.x5V7c7GqS5.Y/Y1gUuekF/b6aA1k9i9k9i9k9i9k9i9k9i9k9i', '+91 1129955533', 'blood_bank', 'Delhi', 'New Delhi', '110062', 1, 1, 1),
(5, 'Suresh Malhotra', 'suresh@gmail.com', '$2a$10$7R.x5V7c7GqS5.Y/Y1gUuekF/b6aA1k9i9k9i9k9i9k9i9k9i9k9i', '+91 9988776655', 'recipient', 'Maharashtra', 'Mumbai', '400050', 1, 1, 1),
(6, 'City General Hospital', 'contact@cityhospital.org', '$2a$10$7R.x5V7c7GqS5.Y/Y1gUuekF/b6aA1k9i9k9i9k9i9k9i9k9i9k9i', '+91 2226549999', 'hospital', 'Maharashtra', 'Mumbai', '400051', 1, 1, 1);

INSERT INTO Donors (user_id, blood_group, age, gender, weight, last_donation_date, is_available, address, total_donations) VALUES
(2, 'O+', 28, 'Male', 72.5, '2026-05-10', 1, 'Andheri East, Mumbai', 8),
(3, 'A-', 25, 'Female', 58.0, '2026-06-15', 1, 'Koramangala, Bengaluru', 5);

INSERT INTO Recipients (user_id, emergency_contact, relationship_to_patient) VALUES
(5, '+91 9988776655', 'Son');

INSERT INTO BloodBanks (user_id, name, license_number, contact_person, phone, email, state, city, full_address, pincode, operating_hours, is_approved) VALUES
(4, 'Rotary Blood Bank & Research Centre', 'DL-BB-2024-001', 'Dr. S. K. Gupta', '011-29955533', 'rotary@bloodbanks.org', 'Delhi', 'New Delhi', '10 Tughlakabad Institutional Area, New Delhi', '110062', '24/7', 1);

INSERT INTO Hospitals (user_id, name, license_number, contact_person, phone, email, state, city, full_address, pincode, verification_status) VALUES
(6, 'City General Hospital', 'MH-HOSP-2025-099', 'Dr. A. K. Roy', '022-26549999', 'contact@cityhospital.org', 'Maharashtra', 'Mumbai', 'Bandra West, Mumbai', '400051', 'VERIFIED');

INSERT INTO BloodStock (blood_bank_id, blood_group, component, units_available) VALUES
(1, 'A+', 'WHOLE_BLOOD', 18), (1, 'A-', 'WHOLE_BLOOD', 4), (1, 'B+', 'WHOLE_BLOOD', 22), (1, 'B-', 'WHOLE_BLOOD', 6), 
(1, 'AB+', 'WHOLE_BLOOD', 8), (1, 'AB-', 'WHOLE_BLOOD', 2), (1, 'O+', 'WHOLE_BLOOD', 35), (1, 'O-', 'WHOLE_BLOOD', 5);

INSERT INTO BloodRequests (requester_id, hospital_id, patient_name, blood_group, component, units_needed, units_fulfilled, hospital_name, hospital_address, city, state, urgency_level, status, contact_number, required_by_date) VALUES
(5, 1, 'Sunita Malhotra', 'O-', 'WHOLE_BLOOD', 2, 0, 'City General Hospital', 'Bandra West, Mumbai', 'Mumbai', 'Maharashtra', 'Critical', 'APPROVED', '+91 9988776655', '2026-08-20');

INSERT INTO DonationCamps (blood_bank_id, organizer_name, camp_title, date, time_start, time_end, venue_address, city, state, expected_donors, registered_count, status) VALUES
(1, 'Indian Red Cross Society', 'Mega Corporate Voluntary Blood Drive', '2026-08-15', '09:00 AM', '05:00 PM', 'Main Auditorium, Cyber City, Phase 3', 'Gurugram', 'Haryana', 150, 74, 'Upcoming');

