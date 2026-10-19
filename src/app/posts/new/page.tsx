import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createPost } from "@/lib/actions";
import { PostForm } from "@/components/PostForm";
import { addDays, todayKST } from "@/lib/time";
import { getPost } from "@/lib/data";

export const metadata: Metadata = { title: "모집글 쓰기" };

export default async function NewPost({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const today = todayKST();
  let initial: Record<string, string | string[]> = { startDate: addDays(today, 7), deadline: addDays(today, 5), mode: "online" };
  // "복제해서 다시 쓰기": 공개 필드만 가져온다 (연락 링크·비밀번호 제외)
  if (from) {
    const p = await getPost(from);
    if (p && p.status !== "deleted" && p.status !== "hidden") {
      initial = {
        ...initial, title: p.title, category: p.category, tags: p.tags.join(", "), mode: p.mode,
        regionSido: p.region_sido ?? "", regionSigungu: p.region_sigungu ?? "", onlineTool: p.online_tool ?? "",
        days: p.days, timeSlots: p.time_slots, durationWeeks: p.duration_weeks ? String(p.duration_weeks) : "none",
        capacity: String(p.capacity), level: p.level ?? "", description: p.description, nickname: p.author_nickname,
      };
    }
  }
  return (
    <>
      <div className="pt-3">
        <Link href="/" className="btn btn-ghost btn-sm !bg-transparent !px-1"><ChevronLeft size={20} aria-hidden /> 보드</Link>
      </div>
      <h1 className="text-[24px] font-extrabold mt-2 mb-5">스터디 모집글 쓰기</h1>
      <PostForm action={createPost} initial={initial} isEdit={false} today={today} maxStart={addDays(today, 90)} maxDeadline={addDays(today, 30)} />
    </>
  );
}
