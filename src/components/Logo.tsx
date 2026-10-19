/** 모여봄 워드마크. 심볼: 세 사람이 모여 꽃잎처럼 겹친 모양 (소속감 + 봄) */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden focusable="false">
        <rect width="32" height="32" rx="9" fill="var(--primary)" />
        <circle cx="11.5" cy="13" r="4.6" fill="var(--on-primary)" />
        <circle cx="20.5" cy="13" r="4.6" fill="var(--on-primary)" fillOpacity=".85" />
        <circle cx="16" cy="20.5" r="4.6" fill="var(--success-soft)" />
      </svg>
      <span className="text-[20px] font-extrabold tracking-tight">모여봄</span>
    </span>
  );
}
