const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

// Load db and app
const db = require('../db');
const app = require('../server');
const { JWT_SECRET } = require('../middleware/auth');

describe('🛡️ Appointment Object-Level Authorization & IDOR Security Suite', () => {
  let server;
  let baseUrl;

  // In-memory mock database state for deterministic, hermetic testing
  const mockState = {
    users: [
      { id: 101, full_name: 'Donor Alice', email: 'alice@test.com', role: 'donor' },
      { id: 102, full_name: 'Donor Bob', email: 'bob@test.com', role: 'donor' },
      { id: 201, full_name: 'City Blood Bank Alpha', email: 'bank_alpha@test.com', role: 'blood_bank' },
      { id: 202, full_name: 'Metro Blood Bank Beta', email: 'bank_beta@test.com', role: 'blood_bank' },
      { id: 301, full_name: 'Recipient Charlie', email: 'charlie@test.com', role: 'recipient' },
      { id: 999, full_name: 'Admin Dave', email: 'admin@test.com', role: 'admin' }
    ],
    donors: [
      { id: 1, user_id: 101, blood_group: 'O+', age: 28, gender: 'Female', weight: 62.0, is_available: 1 },
      { id: 2, user_id: 102, blood_group: 'A+', age: 32, gender: 'Male', weight: 75.0, is_available: 1 }
    ],
    bloodBanks: [
      { id: 10, user_id: 201, name: 'City Blood Bank Alpha', full_address: '100 Medical Way, Mumbai', phone: '9988776601', city: 'Mumbai', state: 'Maharashtra' },
      { id: 20, user_id: 202, name: 'Metro Blood Bank Beta', full_address: '200 Health Ave, Pune', phone: '9988776602', city: 'Pune', state: 'Maharashtra' }
    ],
    appointments: [
      // Appointment 1: Booked by Donor Alice (id: 1) at Bank Alpha (id: 10)
      { id: 501, donor_id: 1, blood_bank_id: 10, date: '2026-09-01', start_time: '10:00:00', end_time: '11:00:00', status: 'BOOKED' },
      // Appointment 2: Booked by Donor Bob (id: 2) at Bank Beta (id: 20)
      { id: 502, donor_id: 2, blood_bank_id: 20, date: '2026-09-02', start_time: '14:00:00', end_time: '15:00:00', status: 'BOOKED' }
    ],
    auditLogs: []
  };

  // Original db methods to restore after tests
  const origQueryOne = db.queryOne;
  const origQuery = db.query;
  const origExecute = db.execute;

  // Signed JWT Tokens
  let tokenAlice, tokenBob, tokenBankAlpha, tokenBankBeta, tokenCharlieRecipient, tokenAdmin;

  before(async () => {
    // 1. Mock DB methods with in-memory handlers
    db.queryOne = async (sql, params = []) => {
      const cleanSql = sql.replace(/\s+/g, ' ').trim();

      // Check Appointments by ID
      if (cleanSql.includes('SELECT * FROM appointments WHERE id = ?') || cleanSql.includes('FROM appointments WHERE id = ?')) {
        const id = parseInt(params[0], 10);
        return mockState.appointments.find(a => a.id === id) || null;
      }

      // Check Appointment Details (Enriched)
      if (cleanSql.includes('FROM appointments a') && cleanSql.includes('WHERE a.id = ?')) {
        const id = parseInt(params[0], 10);
        const appt = mockState.appointments.find(a => a.id === id);
        if (!appt) return null;
        const donor = mockState.donors.find(d => d.id === appt.donor_id);
        const user = mockState.users.find(u => u.id === donor?.user_id);
        const bank = mockState.bloodBanks.find(b => b.id === appt.blood_bank_id);
        return {
          ...appt,
          donor_name: user?.full_name,
          donor_email: user?.email,
          blood_group: donor?.blood_group,
          blood_bank_name: bank?.name,
          blood_bank_address: bank?.full_address
        };
      }

      // Check Donors by user_id
      if (cleanSql.includes('FROM Donors WHERE user_id = ?')) {
        const userId = parseInt(params[0], 10);
        return mockState.donors.find(d => d.user_id === userId) || null;
      }

      // Check BloodBanks by user_id
      if (cleanSql.includes('FROM BloodBanks WHERE user_id = ?')) {
        const userId = parseInt(params[0], 10);
        return mockState.bloodBanks.find(b => b.user_id === userId) || null;
      }

      // Check Users by ID
      if (cleanSql.includes('FROM Users WHERE id = ?')) {
        const id = parseInt(params[0], 10);
        return mockState.users.find(u => u.id === id) || null;
      }

      return null;
    };

    db.query = async (sql, params = []) => {
      const cleanSql = sql.replace(/\s+/g, ' ').trim();

      // Donor /me appointments
      if (cleanSql.includes('FROM appointments a') && cleanSql.includes('WHERE a.donor_id = ?')) {
        const donorId = parseInt(params[0], 10);
        return mockState.appointments
          .filter(a => a.donor_id === donorId)
          .map(a => {
            const bank = mockState.bloodBanks.find(b => b.id === a.blood_bank_id);
            return { ...a, blood_bank_name: bank?.name, full_address: bank?.full_address };
          });
      }

      // Bank appointments
      if (cleanSql.includes('FROM appointments a') && cleanSql.includes('WHERE a.blood_bank_id = ?')) {
        const bankId = parseInt(params[0], 10);
        return mockState.appointments
          .filter(a => a.blood_bank_id === bankId)
          .map(a => {
            const donor = mockState.donors.find(d => d.id === a.donor_id);
            const user = mockState.users.find(u => u.id === donor?.user_id);
            return { ...a, blood_group: donor?.blood_group, donor_name: user?.full_name };
          });
      }

      return [];
    };

    db.execute = async (sql, params = []) => {
      const cleanSql = sql.replace(/\s+/g, ' ').trim();

      // Reschedule
      if (cleanSql.includes('UPDATE appointments SET date = ?, start_time = ?, end_time = ?, status = \'RESCHEDULED\' WHERE id = ?')) {
        const [date, startTime, endTime, id] = params;
        const appt = mockState.appointments.find(a => a.id === parseInt(id, 10));
        if (appt) {
          appt.date = date;
          appt.start_time = startTime;
          appt.end_time = endTime;
          appt.status = 'RESCHEDULED';
        }
        return { affectedRows: 1 };
      }

      // Cancel
      if (cleanSql.includes('UPDATE appointments SET status = \'CANCELLED\' WHERE id = ?')) {
        const [id] = params;
        const appt = mockState.appointments.find(a => a.id === parseInt(id, 10));
        if (appt) {
          appt.status = 'CANCELLED';
        }
        return { affectedRows: 1 };
      }

      // Status Update
      if (cleanSql.includes('UPDATE appointments SET status = ? WHERE id = ?')) {
        const [status, id] = params;
        const appt = mockState.appointments.find(a => a.id === parseInt(id, 10));
        if (appt) {
          appt.status = status;
        }
        return { affectedRows: 1 };
      }

      // Audit Logs & Notifications
      if (cleanSql.includes('INSERT INTO audit_logs') || cleanSql.includes('INSERT INTO Notifications') || cleanSql.includes('INSERT INTO DonationHistory')) {
        return { insertId: Date.now() };
      }

      return { affectedRows: 1, insertId: Date.now() };
    };

    // 2. Start test server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/appointments`;
        resolve();
      });
    });

    // 3. Generate Signed JWT Tokens
    tokenAlice = jwt.sign({ id: 101, email: 'alice@test.com', role: 'donor', full_name: 'Donor Alice' }, JWT_SECRET);
    tokenBob = jwt.sign({ id: 102, email: 'bob@test.com', role: 'donor', full_name: 'Donor Bob' }, JWT_SECRET);
    tokenBankAlpha = jwt.sign({ id: 201, email: 'bank_alpha@test.com', role: 'blood_bank', full_name: 'City Blood Bank Alpha' }, JWT_SECRET);
    tokenBankBeta = jwt.sign({ id: 202, email: 'bank_beta@test.com', role: 'blood_bank', full_name: 'Metro Blood Bank Beta' }, JWT_SECRET);
    tokenCharlieRecipient = jwt.sign({ id: 301, email: 'charlie@test.com', role: 'recipient', full_name: 'Recipient Charlie' }, JWT_SECRET);
    tokenAdmin = jwt.sign({ id: 999, email: 'admin@test.com', role: 'admin', full_name: 'Admin Dave' }, JWT_SECRET);
  });

  after(async () => {
    // Restore db functions and close server
    db.queryOne = origQueryOne;
    db.query = origQuery;
    db.execute = origExecute;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function makeRequest(path, method = 'GET', token = null, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json();
    return { status: res.status, data };
  }

  // ==========================================================================
  // TEST SCENARIOS
  // ==========================================================================

  test('1. [IDOR Blocked] Donor Bob cannot reschedule Donor Alice\'s appointment (Expect 403 Forbidden)', async () => {
    const res = await makeRequest('/501/reschedule', 'PATCH', tokenBob, {
      date: '2026-09-10',
      start_time: '11:00'
    });

    assert.strictEqual(res.status, 403, 'Cross-donor reschedule must return 403 Forbidden');
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Forbidden/i);
    // Ensure state remained unchanged
    assert.strictEqual(mockState.appointments.find(a => a.id === 501).status, 'BOOKED');
  });

  test('2. [IDOR Blocked] Donor Bob cannot cancel Donor Alice\'s appointment (Expect 403 Forbidden)', async () => {
    const res = await makeRequest('/501/cancel', 'PATCH', tokenBob);

    assert.strictEqual(res.status, 403, 'Cross-donor cancel must return 403 Forbidden');
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Forbidden/i);
    assert.strictEqual(mockState.appointments.find(a => a.id === 501).status, 'BOOKED');
  });

  test('3. [IDOR Blocked] Blood Bank Beta cannot modify appointment at Blood Bank Alpha (Expect 403 Forbidden)', async () => {
    const res = await makeRequest('/501/status', 'PATCH', tokenBankBeta, {
      status: 'CONFIRMED'
    });

    assert.strictEqual(res.status, 403, 'Cross-facility status update must return 403 Forbidden');
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Forbidden/i);
    assert.strictEqual(mockState.appointments.find(a => a.id === 501).status, 'BOOKED');
  });

  test('4. [Role Isolation] Recipient Charlie cannot reschedule or cancel appointments (Expect 403 Forbidden)', async () => {
    const res = await makeRequest('/501/reschedule', 'PATCH', tokenCharlieRecipient, {
      date: '2026-09-15',
      start_time: '12:00'
    });

    assert.strictEqual(res.status, 403, 'Unauthorized role must return 403 Forbidden');
    assert.strictEqual(res.data.success, false);
  });

  test('5. [Data Privacy] Donor Bob cannot view details of Donor Alice\'s appointment (Expect 403 Forbidden & Zero Leakage)', async () => {
    const res = await makeRequest('/501', 'GET', tokenBob);

    assert.strictEqual(res.status, 403, 'Cross-donor detail lookup must return 403 Forbidden');
    assert.strictEqual(res.data.success, false);
    assert.strictEqual(res.data.appointment, undefined, 'Must not leak appointment data in response');
  });

  test('6. [Not Found Handling] Accessing or mutating non-existent appointment returns 404 Not Found', async () => {
    const resGet = await makeRequest('/99999', 'GET', tokenAlice);
    assert.strictEqual(resGet.status, 404, 'Non-existent ID must return 404');
    assert.strictEqual(resGet.data.success, false);

    const resPatch = await makeRequest('/99999/reschedule', 'PATCH', tokenAlice, {
      date: '2026-09-12',
      start_time: '10:00'
    });
    assert.strictEqual(resPatch.status, 404, 'Non-existent ID reschedule must return 404');
  });

  test('7. [Authorized Access] Donor Alice can successfully reschedule her own appointment (Expect 200 OK)', async () => {
    const res = await makeRequest('/501/reschedule', 'PATCH', tokenAlice, {
      date: '2026-09-05',
      start_time: '11:30'
    });

    assert.strictEqual(res.status, 200, 'Owner donor should successfully reschedule with 200 OK');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(mockState.appointments.find(a => a.id === 501).status, 'RESCHEDULED');
  });

  test('8. [Authorized Access] Blood Bank Alpha can update status of appointment at its facility (Expect 200 OK)', async () => {
    const res = await makeRequest('/501/status', 'PATCH', tokenBankAlpha, {
      status: 'CONFIRMED'
    });

    assert.strictEqual(res.status, 200, 'Designated blood bank should update status with 200 OK');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(mockState.appointments.find(a => a.id === 501).status, 'CONFIRMED');
  });

  test('9. [Authorized Access] Administrator can view and override any appointment (Expect 200 OK)', async () => {
    // Admin views Bob's appointment at Bank Beta
    const resDetail = await makeRequest('/502', 'GET', tokenAdmin);
    assert.strictEqual(resDetail.status, 200, 'Admin can view any appointment detail with 200 OK');
    assert.strictEqual(resDetail.data.success, true);
    assert.strictEqual(resDetail.data.appointment.id, 502);

    // Admin updates Bob's appointment status
    const resStatus = await makeRequest('/502/status', 'PATCH', tokenAdmin, {
      status: 'CONFIRMED'
    });
    assert.strictEqual(resStatus.status, 200, 'Admin can update any appointment status with 200 OK');
    assert.strictEqual(mockState.appointments.find(a => a.id === 502).status, 'CONFIRMED');
  });

  test('10. [Authorized Access] Donor Alice can cancel her own appointment (Expect 200 OK)', async () => {
    const res = await makeRequest('/501/cancel', 'PATCH', tokenAlice);

    assert.strictEqual(res.status, 200, 'Owner donor should successfully cancel with 200 OK');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(mockState.appointments.find(a => a.id === 501).status, 'CANCELLED');
  });
});
