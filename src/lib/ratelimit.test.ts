import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRateLimit,
  MAX_RATE_LIMIT_KEYS,
  __resetRateLimitForTests,
  __seedRateLimitForTests,
  __pruneRateLimitForTests,
  __rateLimitBucketCountForTests,
  __hasRateLimitKeyForTests,
} from './ratelimit.ts';

describe('checkRateLimit', () => {
  beforeEach(() => {
    __resetRateLimitForTests();
  });

  it('returns false on the 11th request in the window', () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(checkRateLimit('a', 10, 60_000), true);
    }
    assert.equal(checkRateLimit('a', 10, 60_000), false);
  });

  it('deletes key after window expires (prune)', () => {
    __seedRateLimitForTests('old', [Date.now() - 120_000]);
    assert.equal(__hasRateLimitKeyForTests('old'), true);
    __pruneRateLimitForTests(Date.now(), 60_000);
    assert.equal(__hasRateLimitKeyForTests('old'), false);
  });

  it('does not grow past MAX_RATE_LIMIT_KEYS', () => {
    for (let i = 0; i < MAX_RATE_LIMIT_KEYS + 50; i++) {
      checkRateLimit(`k-${i}`, 10, 60_000);
    }
    assert.ok(__rateLimitBucketCountForTests() <= MAX_RATE_LIMIT_KEYS);
  });
});
