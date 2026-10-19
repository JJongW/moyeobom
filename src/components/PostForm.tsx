"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/actions";
import { CATEGORIES, DAYS, LEVELS, MODES, SIDO, TIME_SLOTS } from "@/lib/constants";
import { ErrorSummary, SubmitButton } from "./client";
import { FieldError } from "./ui";

type Init = Partial<Record<string, string | string[]>>;

const LABELS: Record<string, string> = {
  nickname: "닉네임", secret: "관리 비밀번호", secretConfirm: "비밀번호 확인", title: "제목", category: "분야", tags: "태그",
  mode: "진행 방식", regionSido: "시·도", regionSigungu: "시·군·구", onlineTool: "온라인 도구", days: "요일",
  timeSlots: "시간대", startDate: "시작 예정일", durationWeeks: "기간", capacity: "정원", deadline: "모집 마감일",
  level: "레벨", description: "소개", contactUrl: "연락방 링크",
};

export function PostForm({
  action, initial, isEdit, today, maxStart, maxDeadline,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  initial: Init; isEdit: boolean; today: string; maxStart: string; maxDeadline: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const v: Init = { ...initial, ...(state.values ?? {}) };
  const e = state.errors ?? {};
  const [mode, setMode] = useState<string>(String(v.mode ?? "online"));
  const val = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  const list = (k: string) => (Array.isArray(v[k]) ? (v[k] as string[]) : typeof v[k] === "string" && v[k] ? [v[k] as string] : []);
  const inv = (k: string) => (e[k] ? { "aria-invalid": true as const, "aria-describedby": `e-${k}` } : {});
  // 오류 후 다시 그릴 때 입력값이 남도록 key를 바꿔 기본값을 다시 적용한다
  const formKey = JSON.stringify(state.values ?? {});

  return (
    <form action={formAction} key={formKey} noValidate className="space-y-7">
      <ErrorSummary errors={state.errors} message={state.message} labels={LABELS} />

      {!isEdit ? (
        <section className="card p-5 space-y-5">
          <div>
            <h2 className="text-[17px] font-bold">나를 알려 주세요</h2>
            <p className="text-sm text-text-3 mt-0.5">가입 대신 닉네임과 관리 비밀번호를 써요.</p>
          </div>
          <div id="f-nickname">
            <label className="field-label" htmlFor="nickname">닉네임</label>
            <input id="nickname" name="nickname" className="input" defaultValue={val("nickname")} maxLength={12} autoComplete="nickname" placeholder="한글·영문·숫자 2~12자" {...inv("nickname")} />
            <FieldError id="e-nickname" msg={e.nickname} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div id="f-secret">
              <label className="field-label" htmlFor="secret">관리 비밀번호</label>
              <input id="secret" name="secret" type="password" className="input" minLength={4} maxLength={20} autoComplete="new-password" {...inv("secret")} />
              <FieldError id="e-secret" msg={e.secret} />
            </div>
            <div id="f-secretConfirm">
              <label className="field-label" htmlFor="secretConfirm">비밀번호 확인</label>
              <input id="secretConfirm" name="secretConfirm" type="password" className="input" maxLength={20} autoComplete="new-password" {...inv("secretConfirm")} />
              <FieldError id="e-secretConfirm" msg={e.secretConfirm} />
            </div>
          </div>
          <p className="field-help !mt-0">다른 기기에서 글을 관리할 때 필요해요. 다른 사이트에서 쓰는 비밀번호는 쓰지 마세요.</p>
        </section>
      ) : null}

      <section className="card p-5 space-y-5">
        <h2 className="text-[17px] font-bold">어떤 스터디인가요?</h2>
        <div id="f-title">
          <label className="field-label" htmlFor="title">제목</label>
          <input id="title" name="title" className="input" defaultValue={val("title")} maxLength={40} placeholder="예) 퇴근 후 SQL 기초 4주 완주" {...inv("title")} />
          <FieldError id="e-title" msg={e.title} />
        </div>
        <fieldset id="f-category">
          <legend className="field-label">분야</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <label key={c} className="chip"><input type="radio" name="category" value={c} defaultChecked={val("category") === c} /><span>{c}</span></label>
            ))}
          </div>
          <FieldError id="e-category" msg={e.category} />
        </fieldset>
        <div id="f-tags">
          <label className="field-label" htmlFor="tags">태그 <span className="font-normal text-text-3">(선택, 최대 3개)</span></label>
          <input id="tags" name="tags" className="input" defaultValue={Array.isArray(v.tags) ? v.tags.join(", ") : val("tags")} placeholder="쉼표로 구분 · 예) SQL, 데이터분석" {...inv("tags")} />
          <FieldError id="e-tags" msg={e.tags} />
        </div>
        <fieldset id="f-level">
          <legend className="field-label">레벨 <span className="font-normal text-text-3">(선택)</span></legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(LEVELS).map(([k, l]) => (
              <label key={k} className="chip"><input type="radio" name="level" value={k} defaultChecked={val("level") === k} /><span>{l}</span></label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="card p-5 space-y-5">
        <h2 className="text-[17px] font-bold">어디서, 언제 하나요?</h2>
        <fieldset id="f-mode">
          <legend className="field-label">진행 방식</legend>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(MODES).map(([k, l]) => (
              <label key={k} className="chip [&>span]:w-full [&>span]:justify-center">
                <input type="radio" name="mode" value={k} defaultChecked={mode === k} onChange={() => setMode(k)} /><span>{l}</span>
              </label>
            ))}
          </div>
          <FieldError id="e-mode" msg={e.mode} />
        </fieldset>
        {mode !== "online" ? (
          <div className="grid grid-cols-2 gap-3">
            <div id="f-regionSido">
              <label className="field-label" htmlFor="regionSido">시·도</label>
              <select id="regionSido" name="regionSido" className="input" defaultValue={val("regionSido")} {...inv("regionSido")}>
                <option value="">선택</option>
                {SIDO.map((s) => <option key={s}>{s}</option>)}
              </select>
              <FieldError id="e-regionSido" msg={e.regionSido} />
            </div>
            <div id="f-regionSigungu">
              <label className="field-label" htmlFor="regionSigungu">시·군·구</label>
              <input id="regionSigungu" name="regionSigungu" className="input" defaultValue={val("regionSigungu")} placeholder="예) 마포구" maxLength={10} {...inv("regionSigungu")} />
              <FieldError id="e-regionSigungu" msg={e.regionSigungu} />
            </div>
            <p className="field-help col-span-2 !mt-0">정확한 장소는 연락방에서 정해요. 첫 만남은 카페처럼 열린 장소를 권해요.</p>
          </div>
        ) : null}
        {mode !== "offline" ? (
          <div id="f-onlineTool">
            <label className="field-label" htmlFor="onlineTool">온라인 도구 <span className="font-normal text-text-3">(선택)</span></label>
            <input id="onlineTool" name="onlineTool" className="input" defaultValue={val("onlineTool")} maxLength={20} placeholder="예) Zoom, 디스코드" />
            <FieldError id="e-onlineTool" msg={e.onlineTool} />
          </div>
        ) : null}
        <fieldset id="f-days">
          <legend className="field-label">요일</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <label key={d} className="chip"><input type="checkbox" name="days" value={d} defaultChecked={list("days").includes(d)} /><span className="!px-4">{d}</span></label>
            ))}
          </div>
          <FieldError id="e-days" msg={e.days} />
        </fieldset>
        <fieldset id="f-timeSlots">
          <legend className="field-label">시간대</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TIME_SLOTS).map(([k, l]) => (
              <label key={k} className="chip"><input type="checkbox" name="timeSlots" value={k} defaultChecked={list("timeSlots").includes(k)} /><span>{l}</span></label>
            ))}
          </div>
          <p className="field-help">오전 6~12시 · 오후 12~18시 · 저녁 18~24시. 정확한 시간은 소개에 적어 주세요.</p>
          <FieldError id="e-timeSlots" msg={e.timeSlots} />
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <div id="f-startDate">
            <label className="field-label" htmlFor="startDate">시작 예정일</label>
            <input id="startDate" name="startDate" type="date" className="input" min={isEdit ? undefined : today} max={maxStart} defaultValue={val("startDate")} {...inv("startDate")} />
            <FieldError id="e-startDate" msg={e.startDate} />
          </div>
          <div id="f-durationWeeks">
            <label className="field-label" htmlFor="durationWeeks">기간</label>
            <select id="durationWeeks" name="durationWeeks" className="input" defaultValue={val("durationWeeks") || "4"} {...inv("durationWeeks")}>
              <option value="none">정하지 않음</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => <option key={w} value={w}>{w}주</option>)}
            </select>
            <FieldError id="e-durationWeeks" msg={e.durationWeeks} />
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-5">
        <h2 className="text-[17px] font-bold">몇 명을, 언제까지 모을까요?</h2>
        <div className="grid grid-cols-2 gap-3">
          <div id="f-capacity">
            <label className="field-label" htmlFor="capacity">정원 (방장 포함)</label>
            <select id="capacity" name="capacity" className="input" defaultValue={val("capacity") || "4"} {...inv("capacity")}>
              {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n}명</option>)}
            </select>
            <FieldError id="e-capacity" msg={e.capacity} />
          </div>
          <div id="f-deadline">
            <label className="field-label" htmlFor="deadline">모집 마감일</label>
            <input id="deadline" name="deadline" type="date" className="input" min={today} max={maxDeadline} defaultValue={val("deadline")} {...inv("deadline")} />
            <FieldError id="e-deadline" msg={e.deadline} />
          </div>
        </div>
        <p className="field-help !mt-1">마감일 밤 12시에 자동으로 마감되고, 정원이 차도 바로 마감돼요.</p>
        <div id="f-description">
          <label className="field-label" htmlFor="description">소개</label>
          <textarea id="description" name="description" className="input" defaultValue={val("description")} maxLength={2000} placeholder={"진행 방법, 규칙, 준비물을 적어 주세요.\n예) 매주 수요일 저녁 8시, 각자 문제 3개 풀고 30분 리뷰"} {...inv("description")} />
          <p className="field-help">누구나 볼 수 있어요. 전화번호·상세 주소는 적지 마세요.</p>
          <FieldError id="e-description" msg={e.description} />
        </div>
        <div id="f-contactUrl">
          <label className="field-label" htmlFor="contactUrl">연락방 링크</label>
          <input id="contactUrl" name="contactUrl" type="url" inputMode="url" className="input" defaultValue={val("contactUrl")} placeholder="https://open.kakao.com/…" maxLength={200} {...inv("contactUrl")} />
          <p className="field-help">수락한 사람에게만 보여요. 카카오 오픈채팅·디스코드 초대 링크 등.</p>
          <FieldError id="e-contactUrl" msg={e.contactUrl} />
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-bg via-bg to-transparent px-4 pt-6 safe-bottom">
        <SubmitButton pendingText={isEdit ? "저장하고 있어요…" : "올리고 있어요…"}>{isEdit ? "저장하기" : "모집글 올리기"}</SubmitButton>
      </div>
    </form>
  );
}
