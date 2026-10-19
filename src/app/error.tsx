"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card p-8 mt-6 text-center">
      <p className="text-[18px] font-bold">잠시 문제가 생겼어요</p>
      <p className="mt-1 text-text-2">잠시 후 다시 시도해 주세요.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-5">다시 시도</button>
    </div>
  );
}
