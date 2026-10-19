import "server-only";
import { sql } from "./db";
import { isDemo } from "./demo";

/** IP 해시 기준 요청 제한 (BR-017). 넘으면 false */
export async function allow(ipHash: string, kind: string, limits: { perMinutes: number; max: number }[]): Promise<boolean> {
  if (isDemo) return true;
  for (const l of limits) {
    const r = await sql<{ c: number }[]>`
      select count(*)::int c from rate_events
      where kind = ${kind} and ip_hash = ${ipHash} and created_at > now() - (${l.perMinutes} * interval '1 minute')`;
    if (r[0].c >= l.max) return false;
  }
  return true;
}

export async function hit(ipHash: string, kind: string, scope?: string) {
  if (isDemo) return;
  await sql`insert into rate_events (ip_hash, kind, scope) values (${ipHash}, ${kind}, ${scope ?? null})`;
  // 가끔 오래된 기록 정리
  if (Math.random() < 0.02) await sql`delete from rate_events where created_at < now() - interval '2 days'`;
}

/** 같은 대상·같은 IP에서 10분 안에 5번 틀리면 잠금 (FR-001) */
export async function secretLockRemaining(ipHash: string, scope: string): Promise<number> {
  if (isDemo) return 0;
  const r = await sql<{ c: number; first: Date | null }[]>`
    select count(*)::int c, min(created_at) first from rate_events
    where kind = 'secret_fail' and ip_hash = ${ipHash} and scope = ${scope} and created_at > now() - interval '10 minutes'`;
  if (r[0].c < 5 || !r[0].first) return 0;
  return Math.max(1, Math.ceil((r[0].first.getTime() + 10 * 60_000 - Date.now()) / 60_000));
}
