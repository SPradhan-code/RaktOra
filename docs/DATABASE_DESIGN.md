# RaktOra Database Design & Data Architecture

## 1. Executive Summary

RaktOra's database is designed for high-concurrency blood availability tracking, emergency dispatch, and verifiable donor lifecycle management. It uses an **ACID-compliant relational model (MySQL / MariaDB with InnoDB engine)**. 

### Core Design Principles:
1. **Zero-Cost Operation**: Fully compatible with zero-tier MySQL / MariaDB databases (e.g., Aiven free tier, local MySQL, MariaDB on lightweight VMs).
2. **Data Minimization & Privacy**: Never store raw citizen identity numbers (Aadhaar, PAN, Passport). Identity verification references are stored strictly as deterministic SHA-256 cryptographic hashes (`verification_reference`), ensuring verifiable deduplication without violating citizen privacy.
3. **Strict Referencing & Cascade Safety**: Cascading deletions are confined strictly to identity-dependent profiles (`Donors`, `Recipients`), while medical records (`blood_units`, `BloodRequests`, `audit_logs`) maintain referential integrity with `RESTRICT` or `SET NULL` to prevent forensic data loss.
4. **FEFO (First-Expiry, First-Out) Optimization**: Automated stock rotation indices prioritize blood units nearing expiration to minimize critical clinical wastage.

---

## 2. Entity-Relationship Overview

```
                      +------------------+
                      |      Users       | (Core Authentication & Role Base)
                      +--------+---------+
                               | 1:1
        +-------------+--------+--------+-------------+
        |             |                 |             |
        v             v                 v             v
   +---------+  +------------+   +------------+  +-----------+
   | Donors  |  | Recipients |   | BloodBanks |  | Hospitals |
   +----+----+  +-----+------+   +-----+------+  +-----+-----+
        |             |                |               |
        | 1:N         | 1:N            | 1:N           | 1:N
        v             v                v               v
+---------------+ +---------------+ +------------+ +---------------+
| Appointments  | | BloodRequests | | BloodStock | | BloodRequests |
+---------------+ +-------+-------+ +-----+------+ +---------------+
                          |               |
                          |               | 1:N
                          |               v
                          |        +-------------+
                          +------->| blood_units |
                                   +-------------+
```

---

## 3. Detailed Table Specifications

### 3.1. `Users` (Authentication & Identity Directory)
The single source of truth for accounts across all five roles (`donor`, `recipient`, `blood_bank`, `hospital`, `admin`).

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT`, `PRIMARY KEY` | Internal surrogate user identifier |
| `full_name` | `VARCHAR(100)` | `NOT NULL` | Registered display name |
| `email` | `VARCHAR(100)` | `NOT NULL`, `UNIQUE` | Primary user credential for standard login |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Argon2id / bcrypt salted password digest |
| `phone` | `VARCHAR(20)` | `NOT NULL` | Contact number for dispatch alerts |
| `role` | `ENUM(...)` | `NOT NULL`, Default: `'donor'` | Role: `donor`, `recipient`, `blood_bank`, `hospital`, `admin` |
| `state` | `VARCHAR(50)` | `NOT NULL` | Indian State / UT |
| `city` | `VARCHAR(50)` | `NOT NULL` | City / District |
| `pincode` | `VARCHAR(10)` | `NULL` | Postal code |
| `is_verified` | `TINYINT(1)` | `NOT NULL`, Default: `1` | Account readiness status |
| `email_verified` | `TINYINT(1)` | `NOT NULL`, Default: `0` | Email confirmation status |
| `phone_verified` | `TINYINT(1)` | `NOT NULL`, Default: `0` | Phone confirmation status |
| `aadhaar_verified` | `TINYINT(1)` | `NOT NULL`, Default: `0` | Legacy verification flag |
| `digilocker_verified` | `TINYINT(1)` | `NOT NULL`, Default: `0` | 1 if authenticated via genuine DigiLocker |
| `digilocker_verified_at` | `DATETIME` | `NULL` | Timestamp of authorized DigiLocker consent |
| `verification_provider` | `VARCHAR(50)` | `NOT NULL`, Default: `'EMAIL_PASSWORD_REGISTRATION'` | Provider label (`'DIGILOCKER'`, `'MANUAL'`) |
| `verification_reference` | `VARCHAR(255)` | `NULL` | Deterministic SHA-256 hash of provider subject ID |
| `latitude` | `DECIMAL(10, 7)` | `NULL` | GPS coordinate for geographic clustering |
| `longitude` | `DECIMAL(10, 7)` | `NULL` | GPS coordinate for geographic clustering |
| `emergency_alerts_enabled`| `TINYINT(1)` | `NOT NULL`, Default: `1` | Opt-in for proximity emergency broadcast |
| `available_for_donation` | `TINYINT(1)` | `NOT NULL`, Default: `1` | Global availability flag |
| `created_at` | `TIMESTAMP` | Default: `CURRENT_TIMESTAMP` | Registration audit time |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | Last profile update |

**Indexes**:
- `idx_users_email` (`email`)
- `idx_users_role` (`role`)
- `idx_users_location` (`state`, `city`)
- `idx_users_verification_ref` (`verification_provider`, `verification_reference`) — Enables $O(1)$ duplicate prevention without storing raw identity cards.

---

### 3.2. `Donors` (Voluntary Donor Registry)
Extends `Users` for voluntary blood donors. Enforces statutory age and weight safety rules.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT`, `PRIMARY KEY` | Donor profile identifier |
| `user_id` | `INT` | `NOT NULL`, `UNIQUE`, `FK -> Users(id) ON DELETE CASCADE` | 1:1 link to user record |
| `blood_group` | `ENUM(...)` | `NOT NULL` | ABO/Rh: `'A+'`, `'A-'`, `'B+'`, `'B-'`, `'AB+'`, `'AB-'`, `'O+'`, `'O-'` |
| `age` | `INT` | `NOT NULL`, `CHECK (age >= 18 AND age <= 65)` | NBTC statutory donor age limits |
| `gender` | `ENUM(...)` | `NOT NULL` | `'Male'`, `'Female'`, `'Other'` |
| `weight` | `DECIMAL(5,2)` | `CHECK (weight >= 45.0)` | NBTC minimum clinical weight (45.0 kg) |
| `last_donation_date` | `DATE` | `NULL` | Used to compute 90-day male / 120-day female cooling period |
| `is_available` | `TINYINT(1)` | `NOT NULL`, Default: `1` | Self-reported availability |
| `total_donations` | `INT` | `NOT NULL`, Default: `0` | Verified donation counter |
| `address` | `TEXT` | `NULL` | Residential address for local dispatch |
| `created_at` | `TIMESTAMP` | Default: `CURRENT_TIMESTAMP` | Profile creation timestamp |

**Indexes**:
- `idx_donors_blood_group` (`blood_group`)
- `idx_donors_available` (`is_available`)
- `idx_donors_search` (`blood_group`, `is_available`)

---

### 3.3. `BloodBanks` & `Hospitals` (Institutional Registries)
Institutional entities licensed by State/National Blood Transfusion Councils.

- **`BloodBanks`**:
  - `user_id`: 1:1 foreign key to `Users`.
  - `license_number`: Unique institutional drug license number.
  - `operating_hours`: E.g., `'24/7'`.
  - `is_approved`: 1 if verified by state authorities.
- **`Hospitals`**:
  - `user_id`: 1:1 foreign key to `Users`.
  - `license_number`: Unique clinical establishment registration number.
  - `emergency_phone`: Dedicated 24/7 casualty/emergency phone line.

---

### 3.4. `BloodStock` & `blood_units` (Inventory & FEFO Lifecycle)

#### Aggregate Stock (`BloodStock`)
Maintains real-time unit counts per blood group per facility.
- Composite primary key: (`blood_bank_id`, `blood_group`).
- Optimistic locking support via transactional atomic increments (`units_available = units_available - 1 WHERE units_available > 0`).

#### Individual Unit Tracking (`blood_units`)
Tracks individual blood bags through donation, laboratory testing, quarantine, and transfusion.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT`, `PRIMARY KEY` | Unit record identifier |
| `blood_bank_id` | `INT` | `NOT NULL`, `FK -> BloodBanks(id)` | Custodial blood bank |
| `unit_number` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | Unique barcoded bag number |
| `blood_group` | `ENUM(...)` | `NOT NULL` | ABO/Rh group |
| `component_type` | `ENUM(...)` | `NOT NULL` | `'WHOLE_BLOOD'`, `'PRBC'`, `'PLATELETS'`, `'FFP'`, `'CRYOPRECIPITATE'` |
| `collection_date` | `DATE` | `NOT NULL` | Date drawn from donor |
| `expiry_date` | `DATE` | `NOT NULL` | Computed expiration date (PRBC: 35-42 days, Platelets: 5 days) |
| `status` | `ENUM(...)` | `NOT NULL` | `'TESTING'`, `'AVAILABLE'`, `'RESERVED'`, `'TRANSFUSED'`, `'DISCARDED'` |
| `storage_location`| `VARCHAR(100)` | `NULL` | Fridge / shelf barcode |

**Indexes**:
- `idx_blood_units_fefo` (`blood_group`, `component_type`, `status`, `expiry_date`) — Crucial index: allows instantaneous retrieval of the earliest expiring unit for compatibility matching.

---

### 3.5. `BloodRequests` (Emergency Demand Pipeline)
Manages emergency blood requisitions filed by hospitals or individual recipients.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INT` | `AUTO_INCREMENT`, `PRIMARY KEY` | Requisition identifier |
| `patient_name` | `VARCHAR(100)` | `NOT NULL` | Admitted patient name |
| `blood_group` | `ENUM(...)` | `NOT NULL` | Requested ABO/Rh type |
| `units_needed` | `INT` | `NOT NULL`, `CHECK (units_needed > 0)` | Quantity in units |
| `hospital_name` | `VARCHAR(150)` | `NOT NULL` | Facility where transfusion will occur |
| `urgency` | `ENUM(...)` | `NOT NULL` | `'LOW'`, `'MEDIUM'`, `'HIGH'`, `'CRITICAL'` |
| `status` | `ENUM(...)` | `NOT NULL`, Default: `'PENDING'` | `'PENDING'`, `'MATCHED'`, `'PARTIALLY_FULFILLED'`, `'COMPLETED'`, `'CANCELLED'` |
| `doctor_name` | `VARCHAR(100)` | `NULL` | Treating clinical physician |
| `created_at` | `TIMESTAMP` | Default: `CURRENT_TIMESTAMP` | Requisition timestamp |

---

### 3.6. `audit_logs` (Immutable Security Ledger)
Tracks administrative, security, and authentication events without recording sensitive credentials or raw PII.

- `id`: Primary key
- `user_id`: Nullable foreign key (captures failed logins where user is unknown)
- `action`: E.g., `'DIGILOCKER_AUTH_SUCCESS'`, `'LOGIN_FAILED'`, `'STOCK_ALLOCATION'`
- `resource_type`: Table or domain entity affected
- `ip_address`: Client IP for rate-limiting and threat correlation
- `user_agent`: Client browser signature
- `status`: `'SUCCESS'` or `'FAILURE'`
- `details`: JSON payload of metadata (sanitized of passwords, tokens, or raw Aadhaar numbers)
- `created_at`: Immutable timestamp

---

## 4. Migration Architecture

Migrations reside in `database/migrations/` and follow numerical prefixes:

1. **`001_sync_current_schema.sql`**: Baseline initialization creating all primary application tables, check constraints, foreign keys, and indexes.
2. **`002_auth_security_upgrade.sql`**: Upgrades authentication tracking, introduces `email_verified_at`, `phone_verified_at`, and audit triggers.
3. **`003_digilocker_identity_schema.sql`**: Idempotent migration adding:
   - `digilocker_verified` TINYINT(1) DEFAULT 0
   - `digilocker_verified_at` DATETIME NULL
   - `verification_provider` VARCHAR(50) DEFAULT 'EMAIL_PASSWORD_REGISTRATION'
   - `verification_reference` VARCHAR(255) NULL
   - Index: `idx_users_verification_ref (verification_provider, verification_reference)`

### Migration Execution
Migrations are applied idempotently via backend startup or manually in PowerShell:
```powershell
Get-ChildItem -Path "database\migrations\*.sql" | Sort-Object Name | ForEach-Object {
    Write-Host "Applying $($_.Name)..."
    mysql -u root -p raktora < $_.FullName
}
```

---

## 5. Security & Privacy Guarantees

1. **Deterministic Deduplication Without PII Leakage**:
   When DigiLocker sends `digilockerid = "DL-12345"`, RaktOra computes:
   $$\text{verification\_reference} = \text{SHA256}(\text{"DL-12345"})$$
   The raw ID is discarded immediately after token verification. If another account attempts to register with the same DigiLocker account, the query:
   ```sql
   SELECT id FROM Users WHERE verification_provider = 'DIGILOCKER' AND verification_reference = ?
   ```
   detects the collision and prevents duplicate voter/donor identity abuse.
2. **Parameterized Queries**: All queries in the backend use prepared statements (`?` placeholders) via `mysql2/promise`, completely blocking SQL injection.
3. **No Financial Tables**: RaktOra does not store credit cards, bank accounts, UPI IDs, or subscription states. The application operates strictly under a zero-cost voluntary paradigm.
