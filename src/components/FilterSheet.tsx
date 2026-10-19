"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Sheet } from "./client";
import { CATEGORIES, DAYS, LEVELS, MODES, SIDO, TIME_SLOTS } from "@/lib/constants";

type F = {
  q?: string; category?: string[]; mode?: string[]; sido?: string; sigungu?: string;
  days?: string[]; slots?: string[]; level?: string; sort?: string; closed?: boolean;
};

export function FilterSheet({ f, activeCount }: { f: F; activeCount: number }) {
  return (
    <Sheet
      title="조건으로 찾기"
      triggerClassName="btn btn-ghost btn-sm !bg-surface shrink-0"
      trigger={
        <>
          <SlidersHorizontal size={16} aria-hidden /> 필터{activeCount ? <b className="text-primary-ink"> {activeCount}</b> : null}
        </>
      }
    >
      {() => (
        <form action="/" method="get" className="space-y-6 overflow-y-auto max-h-[64dvh] pr-1">
          {f.q ? <input type="hidden" name="q" value={f.q} /> : null}
          <fieldset>
            <legend className="field-label">분야</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <label key={c} className="chip"><input type="checkbox" name="category" value={c} defaultChecked={f.category?.includes(c)} /><span>{c}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="field-label">진행 방식</legend>
            <div className="flex flex-wrap gap-2">
              {(["online", "offline"] as const).map((m) => (
                <label key={m} className="chip"><input type="checkbox" name="mode" value={m} defaultChecked={f.mode?.includes(m)} /><span>{MODES[m]}</span></label>
              ))}
            </div>
            <p className="field-help">온·오프 혼합 스터디는 두 조건 모두에 나와요.</p>
          </fieldset>
          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="field-label col-span-2">지역 (오프라인)</legend>
            <select name="sido" defaultValue={f.sido ?? ""} className="input" aria-label="시·도">
              <option value="">전체 시·도</option>
              {SIDO.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input name="sigungu" defaultValue={f.sigungu ?? ""} className="input" placeholder="시·군·구 (예: 마포구)" aria-label="시·군·구" />
          </fieldset>
          <fieldset>
            <legend className="field-label">요일</legend>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <label key={d} className="chip"><input type="checkbox" name="days" value={d} defaultChecked={f.days?.includes(d)} /><span>{d}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="field-label">시간대</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TIME_SLOTS).map(([k, v]) => (
                <label key={k} className="chip"><input type="checkbox" name="slots" value={k} defaultChecked={f.slots?.includes(k)} /><span>{v}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="field-label">레벨</legend>
            <div className="flex flex-wrap gap-2">
              <label className="chip"><input type="radio" name="level" value="" defaultChecked={!f.level} /><span>전체</span></label>
              {Object.entries(LEVELS).map(([k, v]) => (
                <label key={k} className="chip"><input type="radio" name="level" value={k} defaultChecked={f.level === k} /><span>{v}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="field-label">정렬</legend>
            <div className="flex flex-wrap gap-2">
              {[["latest", "최신순"], ["deadline", "마감 임박순"], ["seats", "남은 자리 많은 순"]].map(([k, v]) => (
                <label key={k} className="chip"><input type="radio" name="sort" value={k} defaultChecked={(f.sort ?? "latest") === k} /><span>{v}</span></label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 text-[15px] font-semibold">
            <input type="checkbox" name="closed" value="1" defaultChecked={f.closed} className="size-5 accent-[var(--primary)]" />
            마감된 글도 보기
          </label>
          <div className="sticky bottom-0 grid grid-cols-[1fr_2fr] gap-2 bg-surface pt-2">
            <Link href="/" className="btn btn-ghost btn-lg">초기화</Link>
            <button className="btn btn-primary btn-lg" type="submit">적용하기</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
