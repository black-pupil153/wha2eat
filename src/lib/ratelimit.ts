// 内存型滑动窗口限流，按 key 记录请求时间戳
const buckets = new Map<string, number[]>();

/** 未超限返回 true，超限返回 false */
export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60000
): boolean {
  const now = Date.now();
  const timestamps = buckets.get(key) ?? [];
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= limit) {
    buckets.set(key, valid);
    return false;
  }

  valid.push(now);
  buckets.set(key, valid);
  return true;
}
