"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/lib/actions";
import { Sheet, SubmitButton, Toast } from "./client";
import { AppStatusBadge, FieldError } from "./ui";

type App = { id: string; nickname: string; message: string; status: string; createdLabel: string; reason: string | null; waitingLong: boolean };

export function ApplicantCard({
  a, canAccept, accept, reject, undo, remove,
}: {
  a: App; canAccept: boolean;
  accept: (s: FormState) => Promise<FormState>;
  reject: (s: FormState, fd: FormData) => Promise<FormState>;
  undo: () => Promise<FormState>;
  remove: (s: FormState, fd: FormData) => Promise<FormState>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [undoable, setUndoable] = useState(false);
  const [, rejAction] = useActionState(async (s: FormState, fd: FormData) => {
    const r = await reject(s, fd);
    if (r.message) setToast(`${r.message}#${Date.now()}`);
    router.refresh();
    return r;
  }, {} as FormState);
  const [remState, remAction] = useActionState(async (s: FormState, fd: FormData) => {
    const r = await remove(s, fd);
    if (r.ok) { setToast(`${r.message}#${Date.now()}`); router.refresh(); }
    return r;
  }, {} as FormState);
  useEffect(() => {
    if (!undoable) return;
    const t = setTimeout(() => setUndoable(false), 25_000);
    return () => clearTimeout(t);
  }, [undoable]);

  return (
    <li className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-[17px]">{a.nickname}</p>
        <AppStatusBadge status={a.status} />
      </div>
      <p className="text-[13px] text-text-3 mt-0.5">
        {a.createdLabel} 손 들었어요{a.waitingLong ? <span className="ml-2 badge badge-orange">3일째 기다리는 중</span> : null}
      </p>
      <p className="mt-3 rounded-xl bg-surface-2 p-3 text-[15px] whitespace-pre-wrap">{a.message}</p>
      {a.reason ? <p className="mt-2 text-sm text-text-3">메모: {a.reason}</p> : null}

      {a.status === "pending" ? (
        <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
          <Sheet title={`${a.nickname}님에게 다음을 기약하기`} trigger="다음에" triggerClassName="btn btn-ghost">
            {() => (
              <form action={rejAction} className="space-y-4">
                <div>
                  <label className="field-label" htmlFor={`rr-${a.id}`}>방장 메모 <span className="font-normal text-text-3">(선택, 100자)</span></label>
                  <input id={`rr-${a.id}`} name="reason" className="input" maxLength={100} placeholder="예) 이번엔 시간대가 맞지 않았어요. 다음에 꼭 같이 해요!" />
                </div>
                <label className="flex items-center gap-3 text-[15px] font-semibold">
                  <input type="checkbox" name="reasonVisible" className="size-5 accent-[var(--primary)]" /> 상대에게 메모 보여 주기
                </label>
                <SubmitButton className="btn btn-ghost btn-lg w-full">전하기</SubmitButton>
              </form>
            )}
          </Sheet>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canAccept || pending}
            aria-busy={pending}
            onClick={() => start(async () => {
              const r = await accept({});
              setToast(`${r.message}#${Date.now()}`);
              if (r.ok) setUndoable(true);
              router.refresh();
            })}
          >
            {canAccept ? "함께하기" : "자리가 다 찼어요"}
          </button>
        </div>
      ) : null}

      {a.status === "accepted" ? (
        <div className="mt-4 flex gap-2">
          {undoable ? (
            <button
              type="button"
              className="btn btn-secondary flex-1"
              disabled={pending}
              onClick={() => start(async () => {
                const r = await undo();
                setUndoable(false);
                setToast(`${r.message}#${Date.now()}`);
                router.refresh();
              })}
            >
              되돌리기
            </button>
          ) : null}
          <Sheet title={`${a.nickname}님 내보내기`} trigger="내보내기" triggerClassName="btn btn-ghost flex-1">
            {() => (
              <form action={remAction} className="space-y-4">
                <p className="text-text-2 -mt-2">내보내면 연락방 링크가 더 이상 보이지 않고, 사유가 당사자에게 전달돼요.</p>
                <div>
                  <label className="field-label" htmlFor={`rm-${a.id}`}>사유 (필수)</label>
                  <input id={`rm-${a.id}`} name="reason" className="input" maxLength={100} aria-invalid={!!remState.errors?.reason} />
                  <FieldError id={`e-rm-${a.id}`} msg={remState.errors?.reason} />
                </div>
                {remState.message && !remState.ok ? <p className="field-error">{remState.message}</p> : null}
                <SubmitButton className="btn btn-danger btn-lg w-full">내보내기</SubmitButton>
              </form>
            )}
          </Sheet>
        </div>
      ) : null}
      <Toast message={toast?.split("#")[0]} key={toast ?? "none"} />
    </li>
  );
}
