import { timingSafeEqual } from 'crypto';

/** 500 响应用稳定文案；详情只打服务端日志 */

export function clientErrorMessage(e: unknown, fallback: string): string {
  console.error(e);
  return fallback;
}

/**
 * mode=ai 门禁：需配置 WHA2EAT_AI_TOKEN，且请求头匹配（timing-safe）。
 * mode=quick 不要求 token。
 */
export function isAiModeAllowed(
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const expected = env.WHA2EAT_AI_TOKEN;
  if (!expected) return false;

  const fromHeader = headers.get('x-wha2eat-ai-token')?.trim() ?? '';
  const auth = headers.get('authorization')?.trim() ?? '';
  const fromBearer = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : '';
  const provided = fromHeader || fromBearer;
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
