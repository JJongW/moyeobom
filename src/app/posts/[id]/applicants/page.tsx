import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { closeExpiredPosts, getPost, hasGrant, listApplications, markSeen } from "@/lib/data";
import { getDeviceHash } from "@/lib/security";
import { decideApplication, removeParticipant, undoAccept, verifyAuthor } from "@/lib/actions";
import { ApplicantCard } from "@/components/ApplicantCard";
import { VerifySheet } from "@/components/actions-ui";
import { PostStatusBadge } from "@/components/ui";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "손 든 사람" };

export default async function Applicants({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await closeExpiredPosts();
  const p = await getPost(id);
  if (!p || p.status === "deleted") notFound();
  const device = await getDeviceHash();
  if (!(await hasGrant(device, "post", id))) {
    return (
      <div className="card p-6 mt-6 space-y-4">
        <h1 className="text-[20px] font-bold">손 든 사람을 보려면 확인이 필요해요</h1>
        <p className="text-text-2">손 든 사람의 한마디는 방장만 볼 수 있어요. 관리 비밀번호를 넣어 주세요.</p>
        <VerifySheet kind="author" action={verifyAuthor.bind(null, id)} triggerClassName="btn btn-primary btn-lg w-full" />
      </div>
    );
  }
  await markSeen(device, "post", id);
  const apps = await listApplications(id);
  const left = Math.max(0, p.capacity - 1 - p.accepted_count);
  const active = apps.filter((a) => a.status === "pending" || a.status === "accepted");
  const done = apps.filter((a) => !(a.status === "pending" || a.status === "accepted"));
  const toCard = (a: (typeof apps)[number]) => ({
    id: a.id, nickname: a.applicant_nickname, message: a.message, status: a.status, createdLabel: timeAgo(a.created_at),
    reason: a.reject_reason, waitingLong: a.waiting_long,
  });

  return (
    <>
      <div className="pt-3">
        <Link href={`/posts/${id}`} className="btn btn-ghost btn-sm !bg-transparent !px-1"><ChevronLeft size={20} aria-hidden /> 모집글</Link>
      </div>
      <h1 className="text-[24px] lg:text-[30px] font-extrabold mt-2">손 든 사람</h1>
      <div className="mt-2 mb-5 flex flex-wrap items-center gap-2 text-[15px] text-text-2">
        <PostStatusBadge status={p.status} deadline={p.deadline} />
        <span className="line-clamp-1">{p.title}</span>
      </div>
      <div className="card p-5 mb-4 grid grid-cols-3 text-center">
        <div><p className="text-[13px] text-text-3">확인 중</p><p className="text-[22px] font-extrabold">{p.pending_count}</p></div>
        <div><p className="text-[13px] text-text-3">함께해요</p><p className="text-[22px] font-extrabold text-success">{p.accepted_count}</p></div>
        <div><p className="text-[13px] text-text-3">남은 자리</p><p className="text-[22px] font-extrabold text-primary-ink">{left}</p></div>
      </div>
      <p className="mb-4 text-[14px] text-text-3">닉네임은 본인 확인이 되지 않아요. 함께하기로 한 뒤 연락방에서 한 번 더 확인해 주세요.</p>

      {active.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-bold text-[17px]">아직 손 든 사람이 없어요</p>
          <p className="text-text-2 mt-1">글 링크를 단톡방에 공유해 보세요.</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {active.map((a) => (
            <ApplicantCard
              key={a.id}
              a={toCard(a)}
              canAccept={p.status === "recruiting" && left > 0}
              accept={decideApplication.bind(null, a.id, "accept")}
              reject={decideApplication.bind(null, a.id, "reject")}
              undo={undoAccept.bind(null, a.id)}
              remove={removeParticipant.bind(null, a.id)}
            />
          ))}
        </ul>
      )}

      {done.length ? (
        <details className="mt-6">
          <summary className="cursor-pointer font-semibold text-text-2 py-2">지난 기록 {done.length}건</summary>
          <ul className="grid gap-3 mt-2">
            {done.map((a) => (
              <li key={a.id} className="card p-4 flex items-center justify-between gap-3">
                <span className="font-semibold">{a.applicant_nickname}</span>
                <span className="text-[14px] text-text-3">{({ rejected: "다음에", not_selected: "자리 마감", cancelled: "취소", removed: "팀에서 빠짐", post_deleted: "글 삭제" } as Record<string, string>)[a.status]}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
