import { CATEGORIES, DAYS, LEVELS, MODES, SIDO, TIME_SLOTS } from "./constants";
import { addDays, todayKST } from "./time";

export type FieldErrors = Record<string, string>;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const len = (s: string) => [...s].length;

export const NICK_RE = /^[가-힣A-Za-z0-9]{2,12}$/;

export function validateNickname(nick: string): string | null {
  if (!nick) return "닉네임을 적어 주세요";
  if (!NICK_RE.test(nick)) return "닉네임은 한글·영문·숫자 2~12자로 적어 주세요";
  return null;
}

export function validateSecret(secret: string): string | null {
  if (!secret) return "비밀번호를 적어 주세요";
  if (len(secret) < 4 || len(secret) > 20) return "비밀번호는 4~20자로 적어 주세요";
  return null;
}

export type PostInput = {
  title: string;
  category: string;
  tags: string[];
  mode: keyof typeof MODES;
  regionSido: string | null;
  regionSigungu: string | null;
  onlineTool: string | null;
  days: string[];
  timeSlots: string[];
  startDate: string;
  durationWeeks: number | null;
  capacity: number;
  deadline: string;
  level: string | null;
  description: string;
  contactUrl: string;
};

/** 모집글 폼 검증 (FR-003). 서버에서 다시 검증하므로 화면 검증과 같은 규칙을 쓴다 */
export function parsePostForm(fd: FormData, opts: { isEdit: boolean; minCapacity?: number }) {
  const errors: FieldErrors = {};
  const today = todayKST();

  const title = str(fd, "title");
  if (len(title) < 5 || len(title) > 40) errors.title = "제목은 5~40자로 적어 주세요";

  const category = str(fd, "category");
  if (!(CATEGORIES as readonly string[]).includes(category)) errors.category = "분야를 골라 주세요";

  const tags = str(fd, "tags")
    .split(/[,\s#]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tags.length > 3) errors.tags = "태그는 3개까지 적을 수 있어요";
  else if (tags.some((t) => len(t) > 10)) errors.tags = "태그 하나는 10자까지예요";

  const mode = str(fd, "mode") as keyof typeof MODES;
  if (!(mode in MODES)) errors.mode = "진행 방식을 골라 주세요";

  let regionSido: string | null = str(fd, "regionSido") || null;
  let regionSigungu: string | null = str(fd, "regionSigungu") || null;
  if (mode === "offline" || mode === "hybrid") {
    if (!regionSido || !(SIDO as readonly string[]).includes(regionSido)) errors.regionSido = "오프라인 스터디는 지역을 골라 주세요";
    if (!regionSigungu) errors.regionSigungu = "시·군·구를 적어 주세요 (예: 마포구)";
    else if (!/^[가-힣]{1,8}(시|군|구)$/.test(regionSigungu)) errors.regionSigungu = "시·군·구 이름으로 적어 주세요 (예: 마포구, 수원시)";
  } else {
    regionSido = null;
    regionSigungu = null;
  }

  const onlineTool = str(fd, "onlineTool") || null;
  if (onlineTool && len(onlineTool) > 20) errors.onlineTool = "20자까지 적을 수 있어요";

  const days = fd.getAll("days").map(String).filter((d) => (DAYS as readonly string[]).includes(d));
  if (days.length === 0) errors.days = "요일을 하나 이상 골라 주세요";

  const timeSlots = fd.getAll("timeSlots").map(String).filter((t) => t in TIME_SLOTS);
  if (timeSlots.length === 0) errors.timeSlots = "시간대를 하나 이상 골라 주세요";

  const startDate = str(fd, "startDate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errors.startDate = "시작 예정일을 골라 주세요";
  else if (!opts.isEdit && startDate < today) errors.startDate = "오늘 이후 날짜로 골라 주세요";
  else if (startDate > addDays(today, 90)) errors.startDate = "90일 안의 날짜로 골라 주세요";

  const durRaw = str(fd, "durationWeeks");
  let durationWeeks: number | null = null;
  if (durRaw && durRaw !== "none") {
    durationWeeks = Number(durRaw);
    if (!Number.isInteger(durationWeeks) || durationWeeks < 1 || durationWeeks > 12) errors.durationWeeks = "기간은 1~12주로 골라 주세요";
  }

  const capacity = Number(str(fd, "capacity"));
  const minCap = Math.max(2, opts.minCapacity ?? 2);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 10) errors.capacity = "정원은 방장 포함 2~10명이에요";
  else if (capacity < minCap) errors.capacity = `지금 참여 인원(${minCap}명)보다 적게 줄일 수 없어요`;

  const deadline = str(fd, "deadline");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) errors.deadline = "모집 마감일을 골라 주세요";
  else if (deadline < today) errors.deadline = "오늘 이후 날짜로 골라 주세요";
  else if (deadline > addDays(today, 30)) errors.deadline = "마감일은 오늘부터 30일 안으로 골라 주세요";
  else if (startDate && deadline > startDate) errors.deadline = "마감일은 시작 예정일보다 늦을 수 없어요";

  const levelRaw = str(fd, "level");
  const level = levelRaw && levelRaw in LEVELS ? levelRaw : null;

  const description = str(fd, "description");
  if (len(description) < 20 || len(description) > 2000) errors.description = "소개는 20~2,000자로 적어 주세요";

  const contactUrl = str(fd, "contactUrl");
  try {
    const u = new URL(contactUrl);
    if (u.protocol !== "https:" || len(contactUrl) > 200) throw new Error();
  } catch {
    errors.contactUrl = "https://로 시작하는 링크를 적어 주세요 (200자 이내)";
  }

  const input: PostInput = {
    title, category, tags, mode, regionSido, regionSigungu, onlineTool, days, timeSlots,
    startDate, durationWeeks, capacity, deadline, level, description, contactUrl,
  };
  return { input, errors };
}

export function parseApplyForm(fd: FormData) {
  const errors: FieldErrors = {};
  const nickname = str(fd, "nickname");
  const message = str(fd, "message");
  const secret = String(fd.get("secret") ?? "");
  const n = validateNickname(nickname);
  if (n) errors.nickname = n;
  if (len(message) < 10) errors.message = "10자 이상 적어 주세요";
  else if (len(message) > 300) errors.message = "300자까지 적을 수 있어요";
  const s = validateSecret(secret);
  if (s) errors.secret = s;
  return { nickname, message, secret, errors };
}

/** 폼 값을 다시 채워 주기 위한 직렬화 (비밀번호 제외) */
export function formValues(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$") || /secret/i.test(key)) continue;
    const all = fd.getAll(key).map(String);
    out[key] = key === "days" || key === "timeSlots" ? all : all[0];
  }
  return out;
}
