/** KST(Asia/Seoul) 기준 날짜 유틸 (BR-014) */
export function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 오늘(KST)부터 마감일까지 남은 일수. 오늘 마감이면 0 */
export function daysUntil(ymd: string): number {
  const a = new Date(`${todayKST()}T00:00:00Z`).getTime();
  const b = new Date(`${ymd}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function toYmd(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
}

export function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}월 ${d}일 (${dow})`;
}

export function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return toYmd(date).slice(5).replace("-", "/");
}
