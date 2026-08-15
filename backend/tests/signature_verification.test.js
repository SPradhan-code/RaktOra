const { test, describe } = require('node:test');
const assert = require('node:assert');

// Require encryption utilities (uses existing env or fallback securely)
const { generateSignature, verifySignature } = require('../utils/encryption');

describe('🔐 Cryptographic Signature Verification Suite', () => {

  // Sample test payloads
  const testPayloadString = 'blood_donation_verification_event_#12345';
  const testPayloadObject = {
    donor_id: 101,
    blood_group: 'O+',
    units: 2,
    timestamp: 1770984000
  };

  // ==========================================================================
  // 1. VALID SIGNATURE HANDLING
  // ==========================================================================
  test('1. [Valid Signature - String] Returns true for authentic string payload and signature', () => {
    const signature = generateSignature(testPayloadString);
    assert.strictEqual(typeof signature, 'string');
    assert.strictEqual(signature.length, 64, 'HMAC-SHA256 hex digest must be 64 characters');

    const isValid = verifySignature(testPayloadString, signature);
    assert.strictEqual(isValid, true, 'Authentic signature must verify successfully');
  });

  test('2. [Valid Signature - Object] Returns true for authentic object payload and signature', () => {
    const signature = generateSignature(testPayloadObject);
    const isValid = verifySignature(testPayloadObject, signature);
    assert.strictEqual(isValid, true, 'Authentic object signature must verify successfully');
  });

  test('3. [Valid Signature - Case Tolerant] Accepts uppercase valid hex signature', () => {
    const signature = generateSignature(testPayloadString).toUpperCase();
    const isValid = verifySignature(testPayloadString, signature);
    assert.strictEqual(isValid, true, 'Hex verification should handle valid uppercase hex digests');
  });

  // ==========================================================================
  // 2. INVALID SIGNATURE HANDLING (CORRECT FORMAT, WRONG VALUE)
  // ==========================================================================
  test('4. [Invalid Signature] Returns false when valid 64-char hex signature has incorrect content', () => {
    // 64-character valid hex string of all zeros
    const fakeSignature = '0'.repeat(64);
    const isValid = verifySignature(testPayloadString, fakeSignature);
    assert.strictEqual(isValid, false, 'Tampered/mismatched signature must return false');
  });

  test('5. [Tampered Payload] Returns false when payload is altered after signing', () => {
    const signature = generateSignature(testPayloadString);
    const tamperedPayload = 'blood_donation_verification_event_#99999';

    const isValid = verifySignature(tamperedPayload, signature);
    assert.strictEqual(isValid, false, 'Signature verification must fail for altered payload');
  });

  // ==========================================================================
  // 3. MISSING & NULL SIGNATURE HANDLING
  // ==========================================================================
  test('6. [Missing / Null / Empty Signature] Returns false without throwing unhandled exceptions', () => {
    assert.strictEqual(verifySignature(testPayloadString, null), false, 'null signature must return false');
    assert.strictEqual(verifySignature(testPayloadString, undefined), false, 'undefined signature must return false');
    assert.strictEqual(verifySignature(testPayloadString, ''), false, 'empty string signature must return false');
    assert.strictEqual(verifySignature(testPayloadString, '   '), false, 'whitespace signature must return false');
  });

  // ==========================================================================
  // 4. WRONG-LENGTH SIGNATURE HANDLING (PREVENTS TIMINGSAFEQUAL RANGEERROR)
  // ==========================================================================
  test('7. [Wrong-Length - Truncated] Returns false without crashing for truncated signatures', () => {
    const fullSignature = generateSignature(testPayloadString);

    const lengths = [1, 8, 16, 32, 63];
    for (const len of lengths) {
      const truncated = fullSignature.slice(0, len);
      assert.doesNotThrow(() => {
        const result = verifySignature(testPayloadString, truncated);
        assert.strictEqual(result, false, `Length ${len} truncated signature must return false`);
      }, `Must not throw RangeError on length ${len}`);
    }
  });

  test('8. [Wrong-Length - Oversized] Returns false without crashing for oversized signatures', () => {
    const fullSignature = generateSignature(testPayloadString);

    const oversized65 = fullSignature + 'a';
    const oversized128 = fullSignature.repeat(2);
    const oversized1000 = 'f'.repeat(1000);

    for (const oversized of [oversized65, oversized128, oversized1000]) {
      assert.doesNotThrow(() => {
        const result = verifySignature(testPayloadString, oversized);
        assert.strictEqual(result, false, `Oversized signature of length ${oversized.length} must return false`);
      }, `Must not throw RangeError on length ${oversized.length}`);
    }
  });

  // ==========================================================================
  // 5. MALFORMED ENCODING HANDLING
  // ==========================================================================
  test('9. [Malformed Encoding - Non-Hex Characters] Returns false for 64-char strings with non-hex characters', () => {
    // 64 chars containing non-hex 'z', 'g', special chars
    const nonHexSignature1 = 'z'.repeat(64);
    const nonHexSignature2 = 'a1b2c3d4e5f6g7h8' + '0'.repeat(48);
    const nonHexSignature3 = 'a'.repeat(60) + '!@#$';

    for (const invalidHex of [nonHexSignature1, nonHexSignature2, nonHexSignature3]) {
      assert.doesNotThrow(() => {
        const result = verifySignature(testPayloadString, invalidHex);
        assert.strictEqual(result, false, 'Non-hex string must return false');
      });
    }
  });

  test('10. [Malformed Encoding - Unicode & Emojis] Returns false for unicode and multibyte strings', () => {
    const unicodeSignature = '🩸'.repeat(16); // Multibyte emoji string
    assert.doesNotThrow(() => {
      const result = verifySignature(testPayloadString, unicodeSignature);
      assert.strictEqual(result, false, 'Unicode/emoji signature must return false');
    });
  });

  // ==========================================================================
  // 6. TYPE COERCION RESISTANCE (NON-STRING INPUTS)
  // ==========================================================================
  test('11. [Type Safety] Returns false for non-string signature arguments without crashing', () => {
    const invalidTypes = [
      123456789,
      true,
      false,
      { sig: '0'.repeat(64) },
      ['0'.repeat(64)],
      () => '0'.repeat(64),
      Buffer.from('0'.repeat(64))
    ];

    for (const invalidVal of invalidTypes) {
      assert.doesNotThrow(() => {
        const result = verifySignature(testPayloadString, invalidVal);
        assert.strictEqual(result, false, `Non-string type ${typeof invalidVal} must return false`);
      }, `Must not throw on invalid type ${typeof invalidVal}`);
    }
  });
});
