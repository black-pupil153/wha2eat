import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clientErrorMessage, isAiModeAllowed } from './api-error.ts';

describe('clientErrorMessage', () => {
  it('returns fallback and does not leak message', () => {
    const err = console.error;
    console.error = () => {};
    try {
      const msg = clientErrorMessage(
        new Error('未配置 DEEPSEEK_API_KEY'),
        '生成菜品失败'
      );
      assert.equal(msg, '生成菜品失败');
      assert.ok(!msg.includes('DEEPSEEK'));
    } finally {
      console.error = err;
    }
  });
});

describe('isAiModeAllowed', () => {
  it('denies mode=ai when token unset', () => {
    const h = new Headers();
    assert.equal(isAiModeAllowed(h, {}), false);
  });

  it('denies wrong token', () => {
    const h = new Headers({ 'x-wha2eat-ai-token': 'wrong' });
    assert.equal(isAiModeAllowed(h, { WHA2EAT_AI_TOKEN: 'secret' }), false);
  });

  it('allows matching header token', () => {
    const h = new Headers({ 'x-wha2eat-ai-token': 'secret' });
    assert.equal(isAiModeAllowed(h, { WHA2EAT_AI_TOKEN: 'secret' }), true);
  });

  it('allows matching Bearer token', () => {
    const h = new Headers({ Authorization: 'Bearer secret' });
    assert.equal(isAiModeAllowed(h, { WHA2EAT_AI_TOKEN: 'secret' }), true);
  });
});
