import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getPost, hasGrant } from "@/lib/data";
import { getDeviceHash } from "@/lib/security";
import { updatePost, verifyAuthor } from "@/lib/actions";
import { sql } from "@/lib/db";
import { PostForm } from "@/components/PostForm";
import { VerifySheet } from "@/components/actions-ui";
import { addDays, todayKST } from "@/lib/time";

export const metadata: Metadata = { title: "모집글 수정" };

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPost(id);
  if (!p || p.status === "deleted") notFound();
  const author = await hasGrant(await getDeviceHash(), "post", id);
  const today = todayKST();
  if (!author) {
    return (
      <div className="card p-6 mt-6 space-y-4">
        <h1 className="text-[20px] font-bold">글을 고치려면 확인이 필요해요</h1>
        <p className="text-text-2">글을 올릴 때 정한 관리 비밀번호를 넣어 주세요.</p>
        <VerifySheet kind="author" action={verifyAuthor.bind(null, id)} triggerClassName="btn btn-primary btn-lg w-full" />
      </div>
    );
  }
  if (!["recruiting", "closed"].includes(p.status)) {
    return <p className="card p-6 mt-6">지금은 고칠 수 없는 글이에요.</p>;
  }
  const [{ contact_url }] = await sql<{ contact_url: string }[]>`select contact_url from posts where id = ${id}`;
  const initial = {
    title: p.title, category: p.category, tags: p.tags.join(", "), mode: p.mode, regionSido: p.region_sido ?? "",
    regionSigungu: p.region_sigungu ?? "", onlineTool: p.online_tool ?? "", days: p.days, timeSlots: p.time_slots,
    startDate: p.start_date, durationWeeks: p.duration_weeks ? String(p.duration_weeks) : "none", capacity: String(p.capacity),
    deadline: p.deadline, level: p.level ?? "", description: p.description, contactUrl: contact_url,
  };
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="pt-3">
        <Link href={`/posts/${id}`} className="btn btn-ghost btn-sm !bg-transparent !px-1"><ChevronLeft size={20} aria-hidden /> 모집글</Link>
      </div>
      <h1 className="text-[24px] font-extrabold mt-2 mb-2">모집글 수정</h1>
      {p.pending_count + p.accepted_count > 0 ? (
        <p className="mb-5 text-[15px] text-text-2">진행 방식·지역·요일·시간대·시작일을 바꾸면 손 든 사람과 참여자에게 새 소식으로 알려져요.</p>
      ) : <div className="mb-5" />}
      <PostForm action={updatePost.bind(null, id)} initial={initial} isEdit today={today} maxStart={addDays(today, 90)} maxDeadline={addDays(today, 30)} />
    </div>
  );
}
