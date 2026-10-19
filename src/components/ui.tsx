import { POST_STATUS_LABEL, APP_STATUS_LABEL } from "@/lib/constants";
import { daysUntil } from "@/lib/time";

export function PostStatusBadge({ status, deadline }: { status: string; deadline?: string }) {
  if (status === "recruiting" && deadline) {
    const d = daysUntil(deadline);
    if (d <= 0) return <span className="badge badge-orange">오늘 마감</span>;
    if (d <= 2) return <span className="badge badge-orange">마감 D-{d}</span>;
    return <span className="badge badge-blue">모집 중 · D-{d}</span>;
  }
  const tone = status === "recruiting" ? "badge-blue" : status === "hidden" || status === "deleted" ? "badge-red" : "badge-gray";
  return <span className={`badge ${tone}`}>{POST_STATUS_LABEL[status] ?? status}</span>;
}

export function AppStatusBadge({ status }: { status: string }) {
  const tone =
    status === "accepted" ? "badge-green" : status === "pending" ? "badge-blue" : status === "removed" || status === "rejected" ? "badge-red" : "badge-gray";
  return <span className={`badge ${tone}`}>{APP_STATUS_LABEL[status] ?? status}</span>;
}

export function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="field-error">
      {msg}
    </p>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-[17px] font-bold">{children}</h2>
      {sub ? <p className="text-sm text-text-3 mt-0.5">{sub}</p> : null}
    </div>
  );
}
