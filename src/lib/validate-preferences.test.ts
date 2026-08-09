import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidPreferenceRanges } from './validate-preferences.ts';

describe('isValidPreferenceRanges', () => {
  it('accepts cookDaysPerWeek 3–7 and servings 1–6', () => {
    assert.equal(
      isValidPreferenceRanges({ servings: 3, cookDaysPerWeek: 5 }),
      true
    );
    assert.equal(
      isValidPreferenceRanges({ servings: 1, cookDaysPerWeek: 3 }),
      true
    );
    assert.equal(
      isValidPreferenceRanges({ servings: 6, cookDaysPerWeek: 7 }),
      true
    );
  });

  it('rejects out-of-range cookDaysPerWeek', () => {
    assert.equal(
      isValidPreferenceRanges({ servings: 2, cookDaysPerWeek: 1e8 }),
      false
    );
    assert.equal(
      isValidPreferenceRanges({ servings: 2, cookDaysPerWeek: 2 }),
      false
    );
    assert.equal(
      isValidPreferenceRanges({ servings: 2, cookDaysPerWeek: 8 }),
      false
    );
    assert.equal(
      isValidPreferenceRanges({ servings: 2, cookDaysPerWeek: 5.5 }),
      false
    );
    assert.equal(
      isValidPreferenceRanges({ servings: 2, cookDaysPerWeek: NaN }),
      false
    );
  });

  it('rejects out-of-range servings', () => {
    assert.equal(
      isValidPreferenceRanges({ servings: 0, cookDaysPerWeek: 5 }),
      false
    );
    assert.equal(
      isValidPreferenceRanges({ servings: 7, cookDaysPerWeek: 5 }),
      false
    );
    assert.equal(
      isValidPreferenceRanges({ servings: 3, cookDaysPerWeek: 5 }),
      true
    );
  });
});
