// 사용법: DATABASE_URL=... node scripts/migrate.mjs
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 환경변수가 필요해요");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require", max: 1, onnotice: () => {} });
const ddl = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
await sql.unsafe(ddl);
console.log("스키마 적용 완료");
await sql.end();
