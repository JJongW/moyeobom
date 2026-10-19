import "server-only";
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** 비밀번호를 scrypt 해시로 만든다 (원문은 저장하지 않음, BR-018) */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(secret.normalize("NFKC"), salt, 32);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64url");
  const actual = await scrypt(secret.normalize("NFKC"), Buffer.from(saltB64, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pepper(): string {
  return process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
}

/** IP는 원문 대신 해시로만 다룬다 */
export async function getIpHash(): Promise<string> {
  const h = await headers();
  const raw =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "0.0.0.0";
  return createHmac("sha256", pepper()).update(`ip:${raw}`).digest("hex").slice(0, 32);
}

export const DEVICE_COOKIE = "sb_device";
const ADMIN_COOKIE = "sb_admin";

/** 이 브라우저의 기기 해시. 쿠키가 없으면 null */
export async function getDeviceHash(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(DEVICE_COOKIE)?.value;
  return v && /^[A-Za-z0-9_-]{32,}$/.test(v) ? sha256(v) : null;
}

/** 서버 액션 안에서만 호출: 기기 쿠키가 없으면 새로 발급 */
export async function ensureDeviceHash(): Promise<string> {
  const c = await cookies();
  let v = c.get(DEVICE_COOKIE)?.value;
  if (!v || !/^[A-Za-z0-9_-]{32,}$/.test(v)) {
    v = randomBytes(32).toString("base64url");
    c.set(DEVICE_COOKIE, v, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return sha256(v);
}

export async function clearDevice(): Promise<void> {
  const c = await cookies();
  c.delete(DEVICE_COOKIE);
}

/* ── 운영자 ───────────────────────────────────────── */

function adminToken(issuedAt: number): string {
  const sig = createHmac("sha256", pepper())
    .update(`admin:${issuedAt}:${process.env.ADMIN_PASSWORD ?? ""}`)
    .digest("base64url");
  return `${issuedAt}.${sig}`;
}

export async function isAdmin(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return false;
  const c = await cookies();
  const v = c.get(ADMIN_COOKIE)?.value;
  if (!v) return false;
  const [ts] = v.split(".");
  const issued = Number(ts);
  if (!Number.isFinite(issued) || Date.now() - issued > 1000 * 60 * 60 * 12) return false;
  const expected = adminToken(issued);
  const a = Buffer.from(v);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function loginAdmin(password: string): Promise<boolean> {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  const a = Buffer.from(sha256(password));
  const b = Buffer.from(sha256(real));
  if (!timingSafeEqual(a, b)) return false;
  const c = await cookies();
  c.set(ADMIN_COOKIE, adminToken(Date.now()), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return true;
}

export async function logoutAdmin(): Promise<void> {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
}

export function randomTempSecret(): string {
  return randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8);
}
