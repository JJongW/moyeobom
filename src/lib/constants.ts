export const CATEGORIES = [
  "개발·코딩",
  "AI·데이터",
  "기획·PM",
  "디자인",
  "마케팅",
  "취업·면접",
  "자격증",
  "어학",
  "독서·글쓰기",
  "기타",
] as const;

export const MODES = {
  online: "온라인",
  offline: "오프라인",
  hybrid: "온·오프 혼합",
} as const;
export type Mode = keyof typeof MODES;

export const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export const TIME_SLOTS = {
  morning: "오전",
  afternoon: "오후",
  evening: "저녁",
} as const;
export type TimeSlot = keyof typeof TIME_SLOTS;

export const LEVELS = {
  beginner: "입문",
  intermediate: "중급",
  any: "상관없음",
} as const;

export const SIDO = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
] as const;

export const POST_STATUS_LABEL: Record<string, string> = {
  recruiting: "모집 중",
  closed: "모집 마감",
  finished: "완주했어요",
  deleted: "삭제됨",
  hidden: "숨김",
};

export const APP_STATUS_LABEL: Record<string, string> = {
  pending: "확인 중",
  accepted: "함께해요",
  rejected: "이번엔 어려워요",
  not_selected: "자리가 다 찼어요",
  cancelled: "취소했어요",
  removed: "팀에서 빠졌어요",
  post_deleted: "글이 삭제됐어요",
};

export const REPORT_REASONS = {
  spam: "스팸·도배",
  inappropriate: "부적절한 내용",
  privacy: "개인정보 노출",
  other: "기타",
} as const;

export const PAGE_SIZE = 20;
