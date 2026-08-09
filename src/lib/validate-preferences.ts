/** 校验 preferences 数值字段是否在 PRD 范围内 */

export function isValidPreferenceRanges(prefs: {
  servings: unknown;
  cookDaysPerWeek: unknown;
}): boolean {
  const { servings, cookDaysPerWeek } = prefs;
  return (
    typeof servings === 'number' &&
    Number.isInteger(servings) &&
    servings >= 1 &&
    servings <= 6 &&
    typeof cookDaysPerWeek === 'number' &&
    Number.isInteger(cookDaysPerWeek) &&
    cookDaysPerWeek >= 3 &&
    cookDaysPerWeek <= 7
  );
}
