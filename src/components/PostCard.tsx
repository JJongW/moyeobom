import Link from "next/link";
import { MapPin, Monitor, Users, CalendarDays } from "lucide-react";
import type { PostRow } from "@/lib/data";
import { MODES, TIME_SLOTS } from "@/lib/constants";
import { PostStatusBadge } from "./ui";

export function modeText(p: Pick<PostRow, "mode" | "region_sido" | "region_sigungu">) {
  if (p.mode === "online") return MODES.online;
  const where = [p.region_sido, p.region_sigungu].filter(Boolean).join(" ");
  return `${MODES[p.mode]} · ${where}`;
}

export function scheduleText(p: Pick<PostRow, "days" | "time_slots">) {
  const slots = p.time_slots.map((t) => TIME_SLOTS[t as keyof typeof TIME_SLOTS] ?? t).join("·");
  return `${p.days.join("·")} ${slots}`;
}

export function PostCard({ p }: { p: PostRow }) {
  const left = Math.max(0, p.capacity - 1 - p.accepted_count);
  const dim = p.status !== "recruiting";
  return (
    <li>
      <Link href={`/posts/${p.id}`} className={`card pressable flex h-full flex-col p-5 transition-shadow duration-200 hover:shadow-[0_6px_20px_rgb(31_26_23_/_0.08)] ${dim ? "opacity-70" : ""}`}>
        <div className="flex items-center gap-2 mb-2">
          <PostStatusBadge status={p.status} deadline={p.deadline} />
          <span className="badge badge-gray">{p.category}</span>
        </div>
        <h3 className="text-[18px] font-bold leading-snug line-clamp-2">{p.title}</h3>
        <dl className="mt-3 grid gap-1.5 text-[15px] text-text-2">
          <div className="flex items-center gap-2">
            <dt className="sr-only">진행 방식</dt>
            {p.mode === "online" ? <Monitor size={16} aria-hidden /> : <MapPin size={16} aria-hidden />}
            <dd>{modeText(p)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">일정</dt>
            <CalendarDays size={16} aria-hidden />
            <dd>{scheduleText(p)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">인원</dt>
            <Users size={16} aria-hidden />
            <dd>
              {p.status === "recruiting" ? (
                <>
                  남은 자리 <b className="text-text">{left}명</b> <span className="text-text-3">/ 정원 {p.capacity}명</span>
                </>
              ) : (
                <>참여 {p.accepted_count + 1}명 / 정원 {p.capacity}명</>
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-auto pt-3 flex items-center justify-between text-[13px] text-text-3">
          <span>{p.author_nickname}</span>
          {p.tags.length ? <span className="truncate ml-3">{p.tags.map((t) => `#${t}`).join(" ")}</span> : null}
        </div>
      </Link>
    </li>
  );
}
