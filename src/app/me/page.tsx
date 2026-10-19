import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { closeExpiredPosts, myActivity } from "@/lib/data";
import { getDeviceHash } from "@/lib/security";
import { forgetThisBrowser } from "@/lib/actions";
import { AppStatusBadge, PostStatusBadge } from "@/components/ui";
import { ActionButton } from "@/components/actions-ui";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "내 활동" };

export default async function Me({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "posts" } = await searchParams;
  await closeExpiredPosts();
  const device = await getDeviceHash();
  const { posts, applications } = await myActivity(device);
  const postUnread = posts.reduce((s, p) => s + p.unread, 0);
  const appUnread = applications.reduce((s, a) => s + a.unread, 0);
  const isPosts = tab !== "apps";

  return (
    <>
      <div className="mx-auto max-w-[720px]">
      <h1 className="text-[26px] lg:text-[30px] font-extrabold pt-5">내 활동</h1>
      <p className="mt-1 text-text-2 text-[15px]">이 브라우저에서 올린 글과 지원이에요.</p>

      <div role="tablist" aria-label="내 활동" className="mt-5 grid grid-cols-2 rounded-2xl bg-surface p-1">
        {[["posts", "내가 연 스터디", postUnread, posts.length], ["apps", "내가 손 든 스터디", appUnread, applications.length]].map(([k, l, u, n]) => {
          const on = (k === "posts") === isPosts;
          return (
            <Link key={k as string} href={`/me?tab=${k}`} role="tab" aria-selected={on}
              className={`btn btn-sm !min-h-11 ${on ? "!bg-primary-soft text-primary-ink" : "!bg-transparent text-text-2"}`}>
              {l} {n as number}
              {(u as number) > 0 ? <span className="ml-1 inline-block size-2 rounded-full bg-danger" aria-label="새 소식 있음" /> : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-4">
        {isPosts ? (
          posts.length ? (
            <ul className="grid gap-3">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link href={`/posts/${p.id}`} className="card pressable flex items-center gap-3 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <PostStatusBadge status={p.status} deadline={p.deadline} />
                        {p.unread ? <span className="badge badge-red">새 소식 {p.unread}</span> : null}
                      </div>
                      <p className="font-bold text-[17px] truncate">{p.title}</p>
                      <p className="text-[14px] text-text-3 mt-0.5">확인 중 {p.pending_count} · 함께해요 {p.accepted_count} · {timeAgo(p.created_at)}</p>
                    </div>
                    <ChevronRight className="text-text-3 shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="이 브라우저로 올린 모집글이 없어요" cta={<Link href="/posts/new" className="btn btn-primary">모집글 쓰기</Link>} />
          )
        ) : applications.length ? (
          <ul className="grid gap-3">
            {applications.map((a) => (
              <li key={a.id}>
                <Link href={`/posts/${a.post_id}`} className="card pressable flex items-center gap-3 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AppStatusBadge status={a.status} />
                      {a.unread ? <span className="badge badge-red">새 소식</span> : null}
                    </div>
                    <p className="font-bold text-[17px] truncate">{a.post_title}</p>
                    <p className="text-[14px] text-text-3 mt-0.5 line-clamp-1">{a.unread && a.latest_news ? a.latest_news : `${a.applicant_nickname} · ${timeAgo(a.created_at)}`}</p>
                  </div>
                  <ChevronRight className="text-text-3 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="이 브라우저로 손 든 스터디가 없어요" cta={<Link href="/" className="btn btn-primary">보드 둘러보기</Link>} />
        )}
      </div>

      <section className="card p-5 mt-8 space-y-3">
        <h2 className="font-bold">다른 기기에서 쓴 글·지원이 안 보이나요?</h2>
        <p className="text-[15px] text-text-2">해당 모집글을 열고 아래쪽 <b>“내 글 관리”</b> 또는 <b>“내 지원 확인”</b>에 비밀번호를 넣으면 이 브라우저에도 추가돼요.</p>
        <hr className="border-line" />
        <p className="text-[15px] text-text-2">공용 PC라면 다 쓴 뒤 이 브라우저의 기록을 지워 주세요. 서버의 글·지원은 그대로 남아요.</p>
        <ActionButton action={forgetThisBrowser} className="btn btn-ghost w-full" confirmText="이 브라우저의 기록을 지울까요? 다시 보려면 비밀번호가 필요해요.">
          이 브라우저에서 내 기록 지우기
        </ActionButton>
      </section>
      </div>
    </>
  );
}

function Empty({ text, cta }: { text: string; cta: React.ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-bold text-[17px]">{text}</p>
      <div className="mt-4">{cta}</div>
    </div>
  );
}
