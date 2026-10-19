import "server-only";
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

declare global {
  var __sql: Sql | undefined;
}

function create(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 환경변수가 없습니다. .env.local 또는 배포 설정을 확인하세요.");
  return postgres(url, {
    // Supabase 연결 풀러(트랜잭션 모드)와 서버리스 환경을 위해 prepared statement를 끈다.
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
  });
}

function client(): Sql {
  if (!globalThis.__sql) globalThis.__sql = create();
  return globalThis.__sql;
}

/**
 * 처음 쿼리할 때 연결을 만든다. 빌드(페이지 수집) 단계에서는 DB 주소가 없어도 통과하고,
 * 실제 요청 시점에만 DATABASE_URL을 요구한다.
 */
export const sql = new Proxy(function () {} as unknown as Sql, {
  apply(_t, _this, args) {
    return (client() as unknown as (...a: unknown[]) => unknown)(...args);
  },
  get(_t, prop) {
    const c = client() as unknown as Record<PropertyKey, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
