// 内存型滑动窗口限流，按 key 记录请求时间戳
const buckets = new Map<string, number[]>();

/** 硬顶，防止唯一 key 无限增长 */
export const MAX_RATE_LIMIT_KEYS = 4096;

/** 未超限返回 true，超限返回 false */
export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60000
): boolean {
  const now = Date.now();
  const timestamps = buckets.get(key) ?? [];
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length === 0) {
    buckets.delete(key);
  }

  if (valid.length >= limit) {
    buckets.set(key, valid);
    return false;
  }

  valid.push(now);
  buckets.set(key, valid);

  if (buckets.size > MAX_RATE_LIMIT_KEYS) {
    evictOldestKey(key);
  }

  return true;
}

/** 淘汰「最后请求时间」最旧的 key（保留刚写入的 currentKey） */
function evictOldestKey(currentKey: string): void {
  let oldestKey: string | null = null;
  let oldestTs = Infinity;
  for (const [k, ts] of buckets) {
    if (k === currentKey) continue;
    const last = ts[ts.length - 1] ?? 0;
    if (last < oldestTs) {
      oldestTs = last;
      oldestKey = k;
    }
  }
  if (oldestKey) buckets.delete(oldestKey);
}

/** 仅测试用：清空桶 */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}

/** 仅测试用：写入时间戳 */
export function __seedRateLimitForTests(
  key: string,
  timestamps: number[]
): void {
  buckets.set(key, timestamps);
}

/** 仅测试用：按窗口淘汰过期 key（不计入新请求） */
export function __pruneRateLimitForTests(
  now = Date.now(),
  windowMs = 60000
): void {
  for (const [key, timestamps] of [...buckets.entries()]) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) buckets.delete(key);
    else buckets.set(key, valid);
  }
}

/** 仅测试用：当前桶数量 */
export function __rateLimitBucketCountForTests(): number {
  return buckets.size;
}

/** 仅测试用：某 key 是否仍在 Map 中 */
export function __hasRateLimitKeyForTests(key: string): boolean {
  return buckets.has(key);
}
