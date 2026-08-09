import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp } from './client-ip.ts';

function req(headers: Record<string, string>, ip?: string): Request {
  const r = new Request('http://localhost/api', { headers });
  if (ip !== undefined) {
    (r as Request & { ip?: string }).ip = ip;
  }
  return r;
}

describe('getClientIp', () => {
  const prev = process.env.TRUST_PROXY;

  beforeEach(() => {
    delete process.env.TRUST_PROXY;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = prev;
  });

  it('ignores spoofed X-Forwarded-For when TRUST_PROXY is off', () => {
    const ip = getClientIp(
      req({ 'x-forwarded-for': '1.2.3.4' }),
      { TRUST_PROXY: undefined }
    );
    assert.equal(ip, 'direct');
  });

  it('uses x-vercel-forwarded-for when present (no trust proxy)', () => {
    const ip = getClientIp(
      req({
        'x-forwarded-for': '1.2.3.4',
        'x-vercel-forwarded-for': '9.9.9.9',
      }),
      {}
    );
    assert.equal(ip, '9.9.9.9');
  });

  it('uses x-real-ip when TRUST_PROXY=1', () => {
    const ip = getClientIp(
      req({
        'x-real-ip': '10.0.0.1',
        'x-forwarded-for': '1.2.3.4, 10.0.0.1',
      }),
      { TRUST_PROXY: '1' }
    );
    assert.equal(ip, '10.0.0.1');
  });

  it('uses rightmost XFF hop when TRUST_PROXY=1 and no x-real-ip', () => {
    const ip = getClientIp(
      req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 10.0.0.9' }),
      { TRUST_PROXY: '1' }
    );
    assert.equal(ip, '10.0.0.9');
  });
});
