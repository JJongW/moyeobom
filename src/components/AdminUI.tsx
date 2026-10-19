"use client";

import { useActionState, useState, useTransition } from "react";
import type { FormState } from "@/lib/actions";
import { SubmitButton } from "./client";
import { FieldError } from "./ui";

export function AdminLoginForm({ action }: { action: (s: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, {} as FormState);
  return (
    <form action={formAction} className="card p-6 mt-6 space-y-4">
      <h1 className="text-[20px] font-bold">운영자 확인</h1>
      {state.message ? <p role="alert" className="field-error">{state.message}</p> : null}
      <div>
        <label htmlFor="pw" className="field-label">운영자 비밀번호</label>
        <input id="pw" name="password" type="password" className="input" autoComplete="current-password" aria-invalid={!!state.errors?.password} />
        <FieldError id="e-pw" msg={state.errors?.password} />
      </div>
      <SubmitButton>들어가기</SubmitButton>
    </form>
  );
}

export function ResetSecretButton({ action, label }: { action: () => Promise<FormState>; label: string }) {
  const [pending, start] = useTransition();
  const [temp, setTemp] = useState<string | null>(null);
  return temp ? (
    <span className="badge badge-green !h-auto py-1">임시 비밀번호 <b className="ml-1 select-all">{temp}</b></span>
  ) : (
    <button type="button" className="btn btn-ghost btn-sm" disabled={pending}
      onClick={() => { if (confirm(`${label}을 초기화할까요? 본인 확인을 먼저 해 주세요.`)) start(async () => { const r = await action(); setTemp(r.data?.temp ?? null); }); }}>
      {label} 초기화
    </button>
  );
}

export function DeleteAllForm({ action }: { action: (s: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, {} as FormState);
  return (
    <form action={formAction} className="space-y-3">
      <p className="text-[15px] text-text-2">파일럿 종료 후 모든 글·지원·신고·브라우저 기록을 지워요. 익명 집계 수치만 남아요. 되돌릴 수 없어요.</p>
      <input name="confirm" className="input" placeholder="'전체 삭제'라고 적어 주세요" aria-invalid={!!state.errors?.confirm} />
      <FieldError id="e-del" msg={state.errors?.confirm} />
      {state.ok ? <p className="text-success font-semibold">{state.message}</p> : null}
      <SubmitButton className="btn btn-danger btn-lg w-full">전체 데이터 삭제</SubmitButton>
    </form>
  );
}
