const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');

const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const requestRoutes = require('../routes/requests');

describe('🩸 Blood Request Fulfillment & Concurrency Suite', () => {
  let app;
  let server;
  let baseUrl;
  let testToken;
  let mockRequests;

  before(async () => {
    mockRequests = new Map();
    let autoId = 100;

    // Mock database state for offline / Aiven simulation
    const originalWithTransaction = db.withTransaction;
    const originalQueryOne = db.queryOne;
    const originalExecute = db.execute;

    db.withTransaction = async (callback) => {
      const mockConn = {
        execute: async (sql, params) => {
          if (sql.includes('SELECT * FROM BloodRequests WHERE id = ? FOR UPDATE')) {
            const reqId = parseInt(params[0], 10);
            const r = mockRequests.get(reqId);
            return [r ? [{ ...r }] : []];
          }
          if (sql.includes('UPDATE BloodRequests SET units_fulfilled = ?')) {
            const [newFulfilled, newStatus, id] = params;
            const reqId = parseInt(id, 10);
            const current = mockRequests.get(reqId);
            if (current) {
              current.units_fulfilled = newFulfilled;
              current.status = newStatus;
              mockRequests.set(reqId, current);
            }
            return [{ affectedRows: 1 }];
          }
          return [[]];
        }
      };
      return await callback(mockConn);
    };

    app = express();
    app.use(express.json());
    app.use('/api/requests', requestRoutes);

    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    testToken = jwt.sign(
      { id: 99, email: 'hospital@raktora.com', role: 'hospital', full_name: 'City General Hospital' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  after(() => {
    if (server) server.close();
  });

  test('1. [Concurrent Fulfillments] Two simultaneous fulfillment requests atomic sum equals required units', async () => {
    const requestId = 101;
    mockRequests.set(requestId, {
      id: requestId,
      patient_name: 'Patient Test',
      blood_group: 'A+',
      component: 'WHOLE_BLOOD',
      units_needed: 2,
      units_fulfilled: 0,
      status: 'APPROVED',
      requester_id: 99
    });

    // Fire 2 concurrent fulfillment requests of 1 unit each
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/requests/${requestId}/fulfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`
        },
        body: JSON.stringify({ units: 1 })
      }),
      fetch(`${baseUrl}/api/requests/${requestId}/fulfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`
        },
        body: JSON.stringify({ units: 1 })
      })
    ]);

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);

    const data1 = await res1.json();
    const data2 = await res2.json();

    assert.strictEqual(data1.success, true);
    assert.strictEqual(data2.success, true);

    const finalState = mockRequests.get(requestId);
    assert.strictEqual(finalState.units_fulfilled, 2, 'Total fulfilled units must equal 2');
    assert.strictEqual(finalState.status, 'FULFILLED', 'Status must transition to FULFILLED');
  });

  test('2. [Over-Fulfillment Prevention] Attempting to fulfill an already fulfilled request returns 400', async () => {
    const requestId = 102;
    mockRequests.set(requestId, {
      id: requestId,
      patient_name: 'Patient Fulfilled',
      blood_group: 'O+',
      component: 'WHOLE_BLOOD',
      units_needed: 1,
      units_fulfilled: 1,
      status: 'FULFILLED',
      requester_id: 99
    });

    const res = await fetch(`${baseUrl}/api/requests/${requestId}/fulfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      },
      body: JSON.stringify({ units: 1 })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('already completed or closed'));
  });

  test('3. [Input Validation] Rejects zero or negative units to fulfill', async () => {
    const requestId = 103;
    mockRequests.set(requestId, {
      id: requestId,
      patient_name: 'Patient Active',
      blood_group: 'B+',
      component: 'WHOLE_BLOOD',
      units_needed: 5,
      units_fulfilled: 0,
      status: 'APPROVED',
      requester_id: 99
    });

    const res = await fetch(`${baseUrl}/api/requests/${requestId}/fulfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      },
      body: JSON.stringify({ units: 0 })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('positive integer'));
  });
});
