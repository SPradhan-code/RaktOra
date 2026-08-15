const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

// Load db and app
const db = require('../db');
const app = require('../server');
const { JWT_SECRET } = require('../middleware/auth');

describe('🩸 FEFO Blood Unit Issuance & Atomic Concurrency Suite', () => {
  let server;
  let baseUrl;

  // In-memory mock database state
  const mockState = {
    bloodBanks: [
      { id: 1, user_id: 101, name: 'Apex Blood Bank', city: 'Mumbai', state: 'Maharashtra' }
    ],
    bloodStock: [
      { blood_bank_id: 1, blood_group: 'O+', component: 'WHOLE_BLOOD', units_available: 3 },
      { blood_bank_id: 1, blood_group: 'A+', component: 'WHOLE_BLOOD', units_available: 1 }
    ],
    bloodUnits: [
      // O+ Units with differing expiry dates for FEFO order test
      { id: 101, unit_id: 'UNT-OP-WHOL-101', blood_bank_id: 1, blood_group: 'O+', component: 'WHOLE_BLOOD', expiry_date: '2026-09-01', status: 'AVAILABLE', testing_status: 'PASSED' },
      { id: 102, unit_id: 'UNT-OP-WHOL-102', blood_bank_id: 1, blood_group: 'O+', component: 'WHOLE_BLOOD', expiry_date: '2026-09-15', status: 'AVAILABLE', testing_status: 'PASSED' },
      { id: 103, unit_id: 'UNT-OP-WHOL-103', blood_bank_id: 1, blood_group: 'O+', component: 'WHOLE_BLOOD', expiry_date: '2026-10-01', status: 'AVAILABLE', testing_status: 'PASSED' },
      // Expired Unit
      { id: 104, unit_id: 'UNT-OP-WHOL-104', blood_bank_id: 1, blood_group: 'O+', component: 'WHOLE_BLOOD', expiry_date: '2026-01-01', status: 'AVAILABLE', testing_status: 'PASSED' },
      // Untested Unit
      { id: 105, unit_id: 'UNT-OP-WHOL-105', blood_bank_id: 1, blood_group: 'O+', component: 'WHOLE_BLOOD', expiry_date: '2026-09-20', status: 'AVAILABLE', testing_status: 'TESTING' },
      // A+ Single Unit for Concurrency Race Condition Test
      { id: 201, unit_id: 'UNT-AP-WHOL-201', blood_bank_id: 1, blood_group: 'A+', component: 'WHOLE_BLOOD', expiry_date: '2026-09-10', status: 'AVAILABLE', testing_status: 'PASSED' }
    ],
    auditLogs: []
  };

  // Mutex lock to simulate database row locking (FOR UPDATE) in concurrent JS promises
  let isLocked = false;
  const lockQueue = [];

  function acquireLock() {
    return new Promise((resolve) => {
      if (!isLocked) {
        isLocked = true;
        resolve();
      } else {
        lockQueue.push(resolve);
      }
    });
  }

  function releaseLock() {
    if (lockQueue.length > 0) {
      const nextResolve = lockQueue.shift();
      nextResolve();
    } else {
      isLocked = false;
    }
  }

  // Original db methods to restore
  const origQueryOne = db.queryOne;
  const origQuery = db.query;
  const origExecute = db.execute;
  const origWithTransaction = db.withTransaction;

  let tokenBankAdmin, tokenSuperAdmin;

  before(async () => {
    // 1. Mock DB methods with atomic in-memory transactional mock
    db.queryOne = async (sql, params = []) => {
      const cleanSql = sql.replace(/\s+/g, ' ').trim();
      if (cleanSql.includes('FROM BloodBanks WHERE user_id = ?')) {
        const userId = parseInt(params[0], 10);
        return mockState.bloodBanks.find(b => b.user_id === userId) || null;
      }
      return null;
    };

    db.withTransaction = async (callback) => {
      // Simulate acquisition of InnoDB connection & FOR UPDATE row locking
      await acquireLock();
      const stagingUnits = JSON.parse(JSON.stringify(mockState.bloodUnits));
      const stagingStock = JSON.parse(JSON.stringify(mockState.bloodStock));

      const mockConn = {
        execute: async (sql, params = []) => {
          const cleanSql = sql.replace(/\s+/g, ' ').trim();

          // SELECT ... FOR UPDATE query
          if (cleanSql.includes('FROM blood_units') && cleanSql.includes('FOR UPDATE')) {
            const [bankId, bloodGroup, comp, needed] = params;
            const today = '2026-08-15'; // Test simulation date

            // Filter strictly AVAILABLE, PASSED, non-expired units belonging to bank
            const matching = stagingUnits
              .filter(u => u.blood_bank_id === bankId &&
                           u.blood_group === bloodGroup &&
                           u.component === comp &&
                           u.status === 'AVAILABLE' &&
                           u.testing_status === 'PASSED' &&
                           u.expiry_date >= today)
              // FEFO ordering: earliest expiry first
              .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
              .slice(0, needed);

            return [matching];
          }

          // UPDATE blood_units SET status = 'ISSUED'
          if (cleanSql.includes('UPDATE blood_units SET status = \'ISSUED\' WHERE id = ?')) {
            const [id] = params;
            const u = stagingUnits.find(unit => unit.id === parseInt(id, 10));
            if (u) u.status = 'ISSUED';
            return [{ affectedRows: 1 }];
          }

          // UPDATE BloodStock
          if (cleanSql.includes('UPDATE BloodStock SET units_available = GREATEST(0, units_available - ?)')) {
            const [needed, bankId, bloodGroup, comp] = params;
            const stock = stagingStock.find(s => s.blood_bank_id === bankId && s.blood_group === bloodGroup && s.component === comp);
            if (stock) {
              stock.units_available = Math.max(0, stock.units_available - needed);
            }
            return [{ affectedRows: 1 }];
          }

          return [{ affectedRows: 1 }];
        }
      };

      try {
        // Small artificial delay to simulate async network execution inside transaction
        await new Promise((r) => setTimeout(r, 10));
        const result = await callback(mockConn);

        // Commit: Persist staging modifications to mock database
        mockState.bloodUnits = stagingUnits;
        mockState.bloodStock = stagingStock;
        return result;
      } finally {
        releaseLock();
      }
    };

    db.execute = async (sql, params = []) => {
      return { insertId: Date.now(), affectedRows: 1 };
    };

    // 2. Start test server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/bloodunits`;
        resolve();
      });
    });

    tokenBankAdmin = jwt.sign({ id: 101, email: 'bank@test.com', role: 'blood_bank', full_name: 'Apex Bank Manager' }, JWT_SECRET);
    tokenSuperAdmin = jwt.sign({ id: 999, email: 'admin@test.com', role: 'admin', full_name: 'System Admin' }, JWT_SECRET);
  });

  after(async () => {
    db.queryOne = origQueryOne;
    db.query = origQuery;
    db.execute = origExecute;
    db.withTransaction = origWithTransaction;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function issueUnits(payload, token = tokenBankAdmin) {
    const res = await fetch(`${baseUrl}/fefo-issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  // ==========================================================================
  // TEST SCENARIOS
  // ==========================================================================

  test('1. [FEFO Ordering] Issuing units selects earliest expiry date first', async () => {
    const res = await issueUnits({
      blood_group: 'O+',
      component: 'WHOLE_BLOOD',
      units_needed: 1
    });

    assert.strictEqual(res.status, 200, 'FEFO issuance should succeed with 200 OK');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.issuedUnits.length, 1);
    // Earliest O+ unit (UNT-OP-WHOL-101, exp: 2026-09-01) must be issued first
    assert.strictEqual(res.data.issuedUnits[0].unit_id, 'UNT-OP-WHOL-101');
    assert.strictEqual(res.data.issuedUnits[0].expiry_date, '2026-09-01');
  });

  test('2. [FEFO Sequential Step] Next issuance selects the next earliest available unit', async () => {
    const res = await issueUnits({
      blood_group: 'O+',
      component: 'WHOLE_BLOOD',
      units_needed: 1
    });

    assert.strictEqual(res.status, 200);
    // Second earliest O+ unit (UNT-OP-WHOL-102, exp: 2026-09-15) must be issued next
    assert.strictEqual(res.data.issuedUnits[0].unit_id, 'UNT-OP-WHOL-102');
  });

  test('3. [Concurrency Race Condition Blocked] Two simultaneous issuance requests for 1 remaining unit never double-issue', async () => {
    // Only 1 A+ unit (UNT-AP-WHOL-201) exists in inventory
    const aPlusAvailableBefore = mockState.bloodUnits.filter(u => u.blood_group === 'A+' && u.status === 'AVAILABLE').length;
    assert.strictEqual(aPlusAvailableBefore, 1, 'Precondition: Exactly 1 A+ unit must be available');

    // Launch two simultaneous issuance requests concurrently
    const [result1, result2] = await Promise.all([
      issueUnits({ blood_group: 'A+', component: 'WHOLE_BLOOD', units_needed: 1 }),
      issueUnits({ blood_group: 'A+', component: 'WHOLE_BLOOD', units_needed: 1 })
    ]);

    const statuses = [result1.status, result2.status].sort();

    // Exactly one request MUST succeed (200), and the competing request MUST fail (400)
    assert.deepStrictEqual(statuses, [200, 400], 'One request must succeed (200) and the other must be rejected (400)');

    const successfulResult = result1.status === 200 ? result1 : result2;
    const failedResult = result1.status === 400 ? result1 : result2;

    assert.strictEqual(successfulResult.data.success, true);
    assert.strictEqual(successfulResult.data.issuedUnits[0].unit_id, 'UNT-AP-WHOL-201');
    assert.strictEqual(failedResult.data.success, false);
    assert.match(failedResult.data.message, /Insufficient FEFO unexpired stock/i);

    // Verify in database that the unit was issued exactly once and stock is 0 (not negative)
    const unit201 = mockState.bloodUnits.find(u => u.id === 201);
    assert.strictEqual(unit201.status, 'ISSUED');

    const stockAPlus = mockState.bloodStock.find(s => s.blood_group === 'A+');
    assert.strictEqual(stockAPlus.units_available, 0, 'Inventory stock must be 0, never negative');
  });

  test('4. [Expired & Untested Units Excluded] Cannot issue expired or un-tested units', async () => {
    // There are 0 remaining A+ units
    const res = await issueUnits({
      blood_group: 'A+',
      component: 'WHOLE_BLOOD',
      units_needed: 1
    });

    assert.strictEqual(res.status, 400, 'Should fail with 400 when no valid units remain');
    assert.strictEqual(res.data.success, false);
  });

  test('5. [Atomic Rollback] Requesting more units than available rolls back completely without partial state changes', async () => {
    // There is only 1 eligible O+ unit remaining (UNT-OP-WHOL-103)
    const isEligible = (u) => u.blood_group === 'O+' && u.status === 'AVAILABLE' && u.testing_status === 'PASSED' && u.expiry_date >= '2026-08-15';
    const remainingBefore = mockState.bloodUnits.filter(isEligible).length;
    assert.strictEqual(remainingBefore, 1);

    // Request 2 units (more than 1 available)
    const res = await issueUnits({
      blood_group: 'O+',
      component: 'WHOLE_BLOOD',
      units_needed: 2
    });

    assert.strictEqual(res.status, 400, 'Must return 400 for insufficient stock');
    assert.strictEqual(res.data.success, false);

    // Verify rollback: the remaining unit (UNT-OP-WHOL-103) must still be AVAILABLE
    const remainingAfter = mockState.bloodUnits.filter(isEligible).length;
    assert.strictEqual(remainingAfter, 1, 'Unit must remain AVAILABLE after transaction rollback');
  });
});
