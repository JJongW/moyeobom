"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";

export function SubmitButton({ children, className = "btn btn-primary btn-lg w-full", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (pendingText ?? "처리하고 있어요…") : children}
    </button>
  );
}

/** 바텀시트. 모바일은 아래에서 올라오고, 넓은 화면에서는 가운데 모달 */
export function Sheet({
  trigger, title, children, triggerClassName = "btn btn-ghost", openInitially = false, onClose,
}: {
  trigger?: ReactNode; title: string; children: (close: () => void) => ReactNode; triggerClassName?: string; openInitially?: boolean; onClose?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  useEffect(() => {
    if (openInitially) ref.current?.showModal();
  }, [openInitially]);
  // 렌더 중에 ref를 읽지 않도록 id로 dialog를 찾아 닫는다
  const close = () => (document.getElementById(uid) as HTMLDialogElement | null)?.close();
  return (
    <>
      {trigger ? (
        <button type="button" className={triggerClassName} onClick={() => ref.current?.showModal()}>
          {trigger}
        </button>
      ) : null}
      <dialog
        ref={ref}
        id={uid}
        className="sheet"
        aria-labelledby={`${uid}-title`}
        onClose={onClose}
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
      >
        <div className="p-5 pt-4 safe-bottom">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 id={`${uid}-title`} className="text-[20px] font-bold leading-snug">{title}</h2>
            <button type="button" onClick={close} className="btn btn-ghost btn-sm !min-h-9 !px-2" aria-label="닫기">
              <X size={20} aria-hidden />
            </button>
          </div>
          {children(close)}
        </div>
      </dialog>
    </>
  );
}

/** 부모가 key를 바꿔 다시 띄운다. message가 없으면 아무것도 그리지 않는다 */
export function Toast({ message }: { message?: string | null }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(t);
  }, [message]);
  if (!message || !visible) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function CopyLinkButton({ path, label = "링크 복사", className = "btn btn-ghost" }: { path?: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          const url = new URL(path ?? window.location.pathname, window.location.origin).toString();
          try { await navigator.clipboard.writeText(url); } catch { window.prompt("링크를 복사해 주세요", url); }
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        }}
      >
        {done ? "복사했어요" : label}
      </button>
    </>
  );
}

/** 실패 시 오류 요약으로 포커스를 옮긴다 (ui-ux-pro-max: Focusable Error Summary) */
export function ErrorSummary({ errors, message, labels }: { errors?: Record<string, string>; message?: string; labels: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const keys = Object.keys(errors ?? {});
  useEffect(() => {
    if (keys.length || message) ref.current?.focus();
  }, [errors, message, keys.length]);
  if (!keys.length && !message) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" aria-labelledby="error-summary-title" className="rounded-2xl bg-danger-soft p-4 mb-5 outline-none">
      <p id="error-summary-title" className="font-bold text-danger">{keys.length ? `${keys.length}곳을 확인해 주세요` : message}</p>
      {keys.length ? (
        <ul className="mt-2 space-y-1 text-[15px]">
          {keys.map((k) => (
            <li key={k}>
              <a className="underline text-danger" href={`#f-${k}`}>{labels[k] ?? k}: {errors![k]}</a>
            </li>
          ))}
        </ul>
      ) : null}
      {keys.length && message ? <p className="mt-2 text-sm text-danger">{message}</p> : null}
    </div>
  );
}
