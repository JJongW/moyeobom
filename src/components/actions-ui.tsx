"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/lib/actions";
import { REPORT_REASONS } from "@/lib/constants";
import { ErrorSummary, Sheet, SubmitButton, Toast, CopyLinkButton } from "./client";
import { FieldError } from "./ui";

/** 확인 후 서버 액션을 실행하고 결과를 토스트로 보여 준다 */
export function ActionButton({
  action, children, className = "btn btn-ghost", confirmText,
}: { action: () => Promise<FormState>; children: React.ReactNode; className?: string; confirmText?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => {
            const r = await action();
            setMsg(r.message ? `${r.message}#${Date.now()}` : null);
            router.refresh();
          });
        }}
      >
        {children}
      </button>
      <Toast message={msg?.split("#")[0]} key={msg ?? "none"} />
    </>
  );
}

export function ApplySheet({ action, postTitle, path, triggerClassName = "btn btn-primary btn-lg w-full" }: { action: (s: FormState, fd: FormData) => Promise<FormState>; postTitle: string; path: string; triggerClassName?: string }) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const router = useRouter();
  const u = useId(); // 모바일·데스크톱 시트가 함께 있어도 id가 겹치지 않게
  return (
    <Sheet
      title={state.ok ? "손 들었어요" : "같이 할래요"}
      triggerClassName={triggerClassName}
      trigger="같이 할래요"
      onClose={() => { if (state.ok) router.refresh(); }}
    >
      {() =>
        state.ok ? (
          <div className="space-y-4">
            <p className="text-text-2">
              방장이 확인하면 이 글에서 <b className="text-text">우리 팀 연락방</b>이 열려요. 알림이 따로 가지 않으니, 링크를 저장해 두고 다시 들어와 확인해 주세요.
            </p>
            <div className="rounded-2xl bg-surface-2 p-4 text-[15px]">
              다른 기기에서는 이 글의 <b>“내 지원 확인”</b>에 닉네임과 확인 비밀번호를 넣으면 돼요.
            </div>
            <CopyLinkButton path={path} label="이 글 링크 복사" className="btn btn-primary btn-lg w-full" />
          </div>
        ) : (
          <form action={formAction} noValidate className="space-y-5" key={JSON.stringify(v)}>
            <p className="text-text-2 -mt-2 line-clamp-2">「{postTitle}」</p>
            <ErrorSummary errors={state.errors} message={state.message} labels={{ nickname: "닉네임", message: "한마디", secret: "확인 비밀번호" }} />
            <div >
              <label className="field-label" htmlFor={`ap-nick-${u}`}>닉네임</label>
              <input id={`ap-nick-${u}`} name="nickname" className="input" defaultValue={String(v.nickname ?? "")} maxLength={12} autoComplete="nickname" placeholder="한글·영문·숫자 2~12자" aria-invalid={!!e.nickname} aria-describedby={e.nickname ? `e-ap-nick-${u}` : undefined} />
              <FieldError id={`e-ap-nick-${u}`} msg={e.nickname} />
            </div>
            <div >
              <label className="field-label" htmlFor={`ap-msg-${u}`}>방장에게 한마디</label>
              <textarea id={`ap-msg-${u}`} name="message" className="input !min-h-28" defaultValue={String(v.message ?? "")} maxLength={300} placeholder="어떤 목표로 참여하고 싶은지, 가능한 시간 등을 적어 주세요 (10~300자)" aria-invalid={!!e.message} aria-describedby={e.message ? `e-ap-msg-${u}` : undefined} />
              <FieldError id={`e-ap-msg-${u}`} msg={e.message} />
            </div>
            <div >
              <label className="field-label" htmlFor={`ap-secret-${u}`}>확인 비밀번호</label>
              <input id={`ap-secret-${u}`} name="secret" type="password" className="input" maxLength={20} autoComplete="new-password" aria-invalid={!!e.secret} aria-describedby={`h-ap-secret-${u}`} />
              <p id={`h-ap-secret-${u}`} className="field-help">다른 기기에서 결과를 확인할 때 써요 (4~20자).</p>
              <FieldError id={`e-ap-secret-${u}`} msg={e.secret} />
            </div>
            <SubmitButton pendingText="손 드는 중…">손 들기</SubmitButton>
          </form>
        )
      }
    </Sheet>
  );
}

export function VerifySheet({
  kind, action, triggerClassName = "btn btn-ghost btn-sm !bg-transparent underline",
}: { kind: "author" | "applicant"; action: (s: FormState, fd: FormData) => Promise<FormState>; triggerClassName?: string }) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state.ok, router]);
  const e = state.errors ?? {};
  const title = kind === "author" ? "내 글 관리" : "내 지원 확인";
  return (
    <Sheet title={title} trigger={title} triggerClassName={triggerClassName}>
      {(close) =>
        state.ok ? (
          <div className="space-y-4">
            <p className="text-text-2">{state.message}</p>
            <button type="button" className="btn btn-primary btn-lg w-full" onClick={close}>확인</button>
          </div>
        ) : (
          <form action={formAction} className="space-y-5" noValidate>
            <p className="text-text-2 -mt-2">
              {kind === "author" ? "글을 올릴 때 정한 관리 비밀번호를 넣어 주세요." : "지원할 때 쓴 닉네임과 확인 비밀번호를 넣어 주세요."}
            </p>
            {state.message ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-danger font-semibold">{state.message}</p> : null}
            {kind === "applicant" ? (
              <div>
                <label className="field-label" htmlFor={`v-nick-${kind}`}>닉네임</label>
                <input id={`v-nick-${kind}`} name="nickname" className="input" defaultValue={String(state.values?.nickname ?? "")} maxLength={12} />
              </div>
            ) : null}
            <div>
              <label className="field-label" htmlFor={`v-secret-${kind}`}>{kind === "author" ? "관리 비밀번호" : "확인 비밀번호"}</label>
              <input id={`v-secret-${kind}`} name="secret" type="password" className="input" maxLength={20} autoComplete="current-password" aria-invalid={!!e.secret} aria-describedby={e.secret ? `e-v-${kind}` : undefined} />
              <FieldError id={`e-v-${kind}`} msg={e.secret} />
            </div>
            <SubmitButton pendingText="확인하고 있어요…">확인하기</SubmitButton>
            <p className="text-[13px] text-text-3">비밀번호를 잊었다면 커뮤니티 운영자에게 문의해 주세요.</p>
          </form>
        )
      }
    </Sheet>
  );
}

export function ReportSheet({ action }: { action: (s: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, {} as FormState);
  return (
    <Sheet title="신고하기" trigger="신고" triggerClassName="btn btn-ghost btn-sm !bg-transparent text-text-3">
      {(close) =>
        state.ok || state.message ? (
          <div className="space-y-4">
            <p className="text-text-2">{state.message}</p>
            <button type="button" className="btn btn-primary btn-lg w-full" onClick={close}>확인</button>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <fieldset className="grid gap-2">
              <legend className="field-label">어떤 문제가 있나요?</legend>
              {Object.entries(REPORT_REASONS).map(([k, l]) => (
                <label key={k} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3.5 font-semibold cursor-pointer">
                  <input type="radio" name="reason" value={k} required className="size-5 accent-[var(--primary)]" /> {l}
                </label>
              ))}
              <FieldError id="e-report" msg={state.errors?.reason} />
            </fieldset>
            <div>
              <label className="field-label" htmlFor="rp-memo">설명 <span className="font-normal text-text-3">(선택)</span></label>
              <input id="rp-memo" name="memo" className="input" maxLength={100} />
            </div>
            <SubmitButton className="btn btn-danger btn-lg w-full">신고하기</SubmitButton>
          </form>
        )
      }
    </Sheet>
  );
}

export function ErrorSummaryInline(props: { errors?: Record<string, string>; message?: string }) {
  return <ErrorSummary {...props} labels={{}} />;
}
