const { test, describe } = require('node:test');
const assert = require('node:assert');

const { isBloodCompatible, COMPATIBILITY_MATRIX, calculateHaversineDistance } = require('../utils/geoUtils');
const { calculateDonorEligibility } = require('../services/eligibilityEngine');

describe('🩺 Business Logic, Medical Eligibility & Compatibility Suite', () => {

  describe('1. Blood Group Compatibility Rules', () => {
    test('O- Negative is the Universal Donor (can give to all 8 blood groups)', () => {
      const allRecipientGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      for (const recipient of allRecipientGroups) {
        assert.strictEqual(
          isBloodCompatible('O-', recipient),
          true,
          `O- must be compatible with recipient ${recipient}`
        );
      }
    });

    test('AB+ Positive is the Universal Recipient (can receive from all 8 blood groups)', () => {
      const allDonorGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      for (const donor of allDonorGroups) {
        assert.strictEqual(
          isBloodCompatible(donor, 'AB+'),
          true,
          `AB+ recipient must be compatible with donor ${donor}`
        );
      }
    });

    test('Rh Positive cannot donate to Rh Negative recipients', () => {
      assert.strictEqual(isBloodCompatible('A+', 'A-'), false);
      assert.strictEqual(isBloodCompatible('B+', 'B-'), false);
      assert.strictEqual(isBloodCompatible('O+', 'O-'), false);
      assert.strictEqual(isBloodCompatible('AB+', 'AB-'), false);
    });

    test('Incompatible ABO antigens are correctly rejected', () => {
      assert.strictEqual(isBloodCompatible('A+', 'B+'), false);
      assert.strictEqual(isBloodCompatible('B+', 'A+'), false);
      assert.strictEqual(isBloodCompatible('AB+', 'O+'), false);
    });
  });

  describe('2. Donor Medical Eligibility Engine', () => {
    test('Standard healthy adult is ELIGIBLE', () => {
      const donor = { age: 28, weight: 70, last_donation_date: null };
      const res = calculateDonorEligibility(donor);
      assert.strictEqual(res.isEligible, true);
      assert.strictEqual(res.status, 'ELIGIBLE');
      assert.strictEqual(res.reasons.length, 0);
    });

    test('Underage donor (<18) is TEMPORARILY_INELIGIBLE', () => {
      const donor = { age: 16, weight: 55 };
      const res = calculateDonorEligibility(donor);
      assert.strictEqual(res.isEligible, false);
      assert.strictEqual(res.status, 'TEMPORARILY_INELIGIBLE');
      assert.ok(res.reasons.some(r => r.includes('18 years')));
    });

    test('Senior donor (>65) requires medical review', () => {
      const donor = { age: 68, weight: 65 };
      const res = calculateDonorEligibility(donor);
      assert.strictEqual(res.isEligible, false);
      assert.strictEqual(res.status, 'REQUIRES_MEDICAL_REVIEW');
      assert.ok(res.reasons.some(r => r.includes('65 years')));
    });

    test('Underweight donor (<45kg) is TEMPORARILY_INELIGIBLE', () => {
      const donor = { age: 22, weight: 42 };
      const res = calculateDonorEligibility(donor);
      assert.strictEqual(res.isEligible, false);
      assert.ok(res.reasons.some(r => r.includes('45 kg')));
    });

    test('Donation within 90-day cooldown interval is TEMPORARILY_INELIGIBLE', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30 days ago (< 90)

      const donor = { age: 25, weight: 60, last_donation_date: recentDate.toISOString() };
      const res = calculateDonorEligibility(donor);
      assert.strictEqual(res.isEligible, false);
      assert.ok(res.reasons.some(r => r.includes('90-day interval')));
    });

    test('Questionnaire flags trigger temporary ineligibility', () => {
      const donor = { age: 25, weight: 60 };
      const res = calculateDonorEligibility(donor, { recentIllness: true, tattooLast6Months: true });
      assert.strictEqual(res.isEligible, false);
      assert.strictEqual(res.reasons.length, 2);
    });
  });

  describe('3. Haversine GPS Distance Calculation', () => {
    test('Calculates accurate spherical distance between two GPS coordinates', () => {
      // Mumbai (19.0760, 72.8777) to Pune (18.5204, 73.8567) ~ 120 km
      const distance = calculateHaversineDistance(19.0760, 72.8777, 18.5204, 73.8567);
      assert.ok(distance > 115 && distance < 130, `Distance should be ~120km, got ${distance}`);
    });

    test('Returns 0 km for identical coordinates', () => {
      const distance = calculateHaversineDistance(28.6139, 77.2090, 28.6139, 77.2090);
      assert.strictEqual(distance, 0);
    });

    test('Handles null / missing coordinates safely without throwing', () => {
      assert.strictEqual(calculateHaversineDistance(null, 77.2090, 28.6139, 77.2090), null);
    });
  });
});
