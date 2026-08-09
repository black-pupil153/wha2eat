/**
 * 限流用客户端身份。
 * - TRUST_PROXY=1：信任反代写入的 X-Real-IP / XFF 最右 hop
 * - 默认（裸暴露）：忽略可伪造的 XFF/X-Real-IP；优先平台头，否则 direct
 */

export function getClientIp(
  request: Request,
  env: NodeJS.ProcessEnv = process.env
): string {
  const trustProxy = env.TRUST_PROXY === '1';

  if (trustProxy) {
    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;

    const xff = request.headers.get('x-forwarded-for');
    if (xff) {
      const parts = xff
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1];
    }
    return 'unknown';
  }

  // 不信任客户端可控的转发头
  const vercel = request.headers
    .get('x-vercel-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  if (vercel) return vercel;

  const maybeIp = (request as Request & { ip?: string }).ip?.trim();
  if (maybeIp) return maybeIp;

  return 'direct';
}
