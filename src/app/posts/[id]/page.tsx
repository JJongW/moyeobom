import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle, ExternalLink } from "lucide-react";
import {
  closeExpiredPosts, getContactUrl, getMyApplicationForPost, getPost, hasGrant, latestNews, logEvent, markSeen,
} from "@/lib/data";
import { getDeviceHash } from "@/lib/security";
import {
  applyToPost, cancelApplication, closePost, deletePost, finishPost, reportPost, verifyApplicant, verifyAuthor,
} from "@/lib/actions";
import { LEVELS } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/time";
import { AppStatusBadge, PostStatusBadge } from "@/components/ui";
import { modeText, scheduleText } from "@/components/PostCard";
import { ActionButton, ApplySheet, ReportSheet, VerifySheet } from "@/components/actions-ui";
import { CopyLinkButton, Toast } from "@/components/client";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await getPost(id);
  return { title: p && p.status !== "hidden" && p.status !== "deleted" ? p.title : "모집글" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3 border-b border-line last:border-0">
      <dt className="w-20 shrink-0 text-text-3">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function ContactCard({ url }: { url: string }) {
  return (
    <section className="card p-5 border-2 border-success/30" aria-labelledby="contact-title">
      <div className="flex items-center gap-2 mb-1">
        <MessageCircle size={20} className="text-success" aria-hidden />
        <h2 id="contact-title" className="text-[17px] font-bold">우리 팀 연락방</h2>
      </div>
      <p className="text-sm text-text-3 mb-3">함께하기로 한 사람과 방장에게만 보여요. 링크가 안 열리면 방장에게 알려 주세요.</p>
      <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[14px] break-all mb-3">{url}</p>
      <div className="grid grid-cols-2 gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary">
          열기 <ExternalLink size={16} aria-hidden />
        </a>
        <CopyLinkButton path={url} label="링크 복사" />
      </div>
    </section>
  );
}

export default async function PostPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  await closeExpiredPosts();
  const p = await getPost(id);
  if (!p || p.status === "deleted") notFound();

  const device = await getDeviceHash();
  const author = await hasGrant(device, "post", id);
  const myApp = author ? null : await getMyApplicationForPost(device, id);

  if (p.status === "hidden" && !author) {
    return (
      <div className="card p-8 mt-6 text-center">
        <p className="text-[18px] font-bold">볼 수 없는 모집글이에요</p>
        <p className="mt-1 text-text-2">운영 정책에 따라 숨겨진 글이에요.</p>
        <Link href="/" className="btn btn-primary mt-5">보드로 가기</Link>
      </div>
    );
  }

  const left = Math.max(0, p.capacity - 1 - p.accepted_count);
  const canSeeContact = author || myApp?.status === "accepted";
  const contactUrl = canSeeContact ? await getContactUrl(id) : null;

  let newsList: { code: string; message: string; created_at: Date }[] = [];
  if (author) {
    newsList = await latestNews("post", id);
    await markSeen(device, "post", id);
  } else if (myApp) {
    newsList = await latestNews("application", myApp.id);
    await markSeen(device, "application", myApp.id);
    await logEvent("my_application_viewed", device, { application_id: myApp.id, status: myApp.status, after_decision: !!myApp.decided_at, via: "token" });
  }
  if (contactUrl && myApp) await logEvent("contact_link_viewed", device, { post_id: id, role: "applicant" });
  await logEvent("post_viewed", device, { post_id: id, post_status: p.status, role: author ? "author" : myApp ? "applicant" : "visitor" });

  const path = `/posts/${id}`;
  const toast = sp.created ? "모집글을 올렸어요" : sp.updated ? "저장했어요" : null;

  const visitor = !author && !myApp;
  const summary = (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <p className="text-[13px] text-text-3">{p.status === "recruiting" ? "남은 자리" : "참여 인원"}</p>
        <p className="text-[24px] font-extrabold">
          {p.status === "recruiting" ? <span className="text-primary-ink">{left}명</span> : `${p.accepted_count + 1}명`}
          <span className="text-[15px] font-semibold text-text-3"> / {p.capacity}명</span>
        </p>
      </div>
      <PostStatusBadge status={p.status} deadline={p.deadline} />
    </div>
  );

  return (
    <>
      <div className="pt-3 flex items-center justify-between">
        <Link href="/" className="btn btn-ghost btn-sm !bg-transparent !px-1"><ChevronLeft size={20} aria-hidden /> 보드</Link>
        <div className="flex items-center">
          <CopyLinkButton path={path} label="공유" className="btn btn-ghost btn-sm !bg-transparent" />
          {!author ? <ReportSheet action={reportPost.bind(null, id)} /> : null}
        </div>
      </div>

      {sp.created && author ? (
        <section className="card p-5 mt-2 bg-primary-soft" aria-live="polite">
          <p className="font-bold text-[17px]">모집글이 올라갔어요</p>
          <p className="mt-1 text-text-2">이 브라우저에서는 바로 관리할 수 있어요. 다른 기기에서는 <b className="text-text">관리 비밀번호</b>가 필요하니 꼭 기억해 두세요.</p>
          <CopyLinkButton path={path} label="단톡방에 공유할 링크 복사" className="btn btn-primary w-full mt-4 lg:w-auto" />
        </section>
      ) : null}

      <div className="mt-3 lg:mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        <article className="space-y-3">
          <section className="card p-5 lg:p-7">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <PostStatusBadge status={p.status} deadline={p.deadline} />
              <span className="badge badge-gray">{p.category}</span>
              {p.level ? <span className="badge badge-gray">{LEVELS[p.level as keyof typeof LEVELS]}</span> : null}
            </div>
            <h1 className="text-[24px] lg:text-[30px] font-extrabold leading-tight tracking-tight">{p.title}</h1>
            <p className="mt-2 text-[14px] text-text-3">
              방장 <b className="text-text-2">{p.author_nickname}</b> · {timeAgo(p.created_at)}
            </p>
            <dl className="mt-4 text-[15px]">
              <Row label="진행">{modeText(p)}{p.online_tool ? ` · ${p.online_tool}` : ""}</Row>
              <Row label="일정">{scheduleText(p)}</Row>
              <Row label="시작">{formatDate(p.start_date)}{p.duration_weeks ? ` · ${p.duration_weeks}주` : " · 기간 미정"}</Row>
              <Row label="인원">
                {p.status === "recruiting" ? (
                  <>남은 자리 <b className="text-primary-ink">{left}명</b> · 정원 {p.capacity}명 (방장 포함)</>
                ) : (
                  <>참여 {p.accepted_count + 1}명 · 정원 {p.capacity}명</>
                )}
              </Row>
              <Row label="마감">{formatDate(p.deadline)} 밤 12시</Row>
            </dl>
          </section>

          <section className="card p-5 lg:p-7">
            <h2 className="text-[17px] font-bold mb-2">소개</h2>
            <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-text">{p.description}</p>
            {p.tags.length ? <p className="mt-4 text-[14px] text-primary-ink">{p.tags.map((t) => `#${t}`).join(" ")}</p> : null}
          </section>

          {newsList.length ? (
            <section className="card p-5" aria-labelledby="news-title">
              <h2 id="news-title" className="text-[17px] font-bold mb-2">새 소식</h2>
              <ul className="divide-y divide-line">
                {newsList.map((n, i) => (
                  <li key={i} className="py-2.5 flex justify-between gap-3 text-[15px]">
                    <span>{n.message}</span>
                    <span className="shrink-0 text-[13px] text-text-3">{timeAgo(n.created_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>

        <aside className="mt-3 space-y-3 lg:mt-0 lg:sticky lg:top-24" aria-label="참여">
          {contactUrl ? <ContactCard url={contactUrl} /> : null}

          {visitor ? (
            <section className="card p-5 space-y-4 hidden lg:block">
              {summary}
              {p.status === "recruiting" ? (
                <ApplySheet action={applyToPost.bind(null, id)} postTitle={p.title} path={path} />
              ) : (
                <button className="btn btn-lg w-full btn-ghost" disabled>모집이 마감됐어요</button>
              )}
              <p className="text-[13px] text-text-3">가입 없이 닉네임과 비밀번호만 있으면 돼요.</p>
            </section>
          ) : null}

          {author ? (
            <section className="card p-5 space-y-3" aria-labelledby="owner-title">
              <h2 id="owner-title" className="text-[17px] font-bold">내 글 관리</h2>
              <div className="hidden lg:block">{summary}</div>
              <Link href={`/posts/${id}/applicants`} className="btn btn-primary btn-lg w-full">
                손 든 사람 보기 {p.pending_count ? <span className="ml-1 rounded-full bg-white/25 px-2 text-[14px]">새로 {p.pending_count}</span> : null}
              </Link>
              <div className="grid grid-cols-2 gap-2">
                {p.status === "recruiting" || p.status === "closed" ? <Link href={`/posts/${id}/edit`} className="btn btn-ghost">수정</Link> : null}
                {p.status === "recruiting" ? (
                  <ActionButton action={closePost.bind(null, id)} confirmText="모집을 마감할까요? 아직 확인 중인 사람에게는 자리가 다 찼다고 알려져요.">모집 마감</ActionButton>
                ) : null}
                {p.status === "closed" ? (
                  <ActionButton action={finishPost.bind(null, id)} className="btn btn-secondary" confirmText="스터디를 완주로 표시할까요?">완주했어요</ActionButton>
                ) : null}
                <Link href={`/posts/new?from=${id}`} className="btn btn-ghost">복제해서 다시 쓰기</Link>
                {p.accepted_count === 0 && p.status !== "hidden" ? (
                  <ActionButton action={deletePost.bind(null, id)} className="btn btn-danger" confirmText="모집글을 삭제할까요? 되돌릴 수 없어요.">삭제</ActionButton>
                ) : null}
              </div>
              {p.status === "hidden" ? <p className="text-danger text-sm font-semibold">신고가 쌓여 숨겨진 글이에요. 운영자가 확인하면 다시 보여요.</p> : null}
            </section>
          ) : null}

          {myApp ? (
            <section className="card p-5 space-y-3" aria-labelledby="my-app-title">
              <div className="flex items-center justify-between">
                <h2 id="my-app-title" className="text-[17px] font-bold">내가 손 든 스터디</h2>
                <AppStatusBadge status={myApp.status} />
              </div>
              <p className="text-[15px] text-text-2">
                <b className="text-text">{myApp.applicant_nickname}</b> · {timeAgo(myApp.created_at)}
              </p>
              <p className="rounded-xl bg-surface-2 p-3 text-[15px] whitespace-pre-wrap">{myApp.message}</p>
              {myApp.status === "pending" ? (
                <div className="rounded-xl bg-primary-soft p-4 text-[15px] space-y-3">
                  <p>방장이 확인하면 이 글에 <b>우리 팀 연락방</b>이 열려요. 알림이 따로 가지 않으니 이 글 링크를 저장해 두세요.</p>
                  <p className="text-text-2 text-[14px]">다른 기기에서는 이 글의 ‘내 지원 확인’에 닉네임과 확인 비밀번호를 넣으면 돼요.</p>
                  <CopyLinkButton path={path} label="이 글 링크 복사" className="btn btn-primary w-full" />
                </div>
              ) : null}
              {myApp.status === "accepted" ? <p className="text-[15px] font-semibold text-success">오늘부터 우리 편! 연락방에서 인사해요.</p> : null}
              {myApp.status === "not_selected" ? <p className="text-[15px] text-text-2">이번엔 자리가 다 찼어요. 다른 스터디도 둘러봐요.</p> : null}
              {(myApp.status === "rejected" || myApp.status === "removed") && myApp.reason_visible && myApp.reject_reason ? (
                <p className="text-[15px] text-text-2">방장 메모: {myApp.reject_reason}</p>
              ) : null}
              {myApp.status === "pending" || myApp.status === "accepted" ? (
                <ActionButton
                  action={cancelApplication.bind(null, myApp.id)}
                  className="btn btn-ghost w-full"
                  confirmText={myApp.status === "accepted" ? "참여를 취소할까요? 방장에게 알려져요." : "손 든 걸 취소할까요?"}
                >
                  {myApp.status === "accepted" ? "참여 취소" : "손 든 거 취소"}
                </ActionButton>
              ) : (
                <Link href="/" className="btn btn-ghost w-full">다른 스터디 둘러보기</Link>
              )}
            </section>
          ) : null}

          {visitor ? (
            <div className="flex justify-center gap-1 text-[14px]">
              <VerifySheet kind="applicant" action={verifyApplicant.bind(null, id)} />
              <VerifySheet kind="author" action={verifyAuthor.bind(null, id)} />
            </div>
          ) : null}
        </aside>
      </div>

      {visitor ? (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-bg via-bg/95 to-transparent pt-6 lg:hidden">
          <div className="mx-auto max-w-[720px] px-4 safe-bottom">
            {p.status === "recruiting" ? (
              <ApplySheet action={applyToPost.bind(null, id)} postTitle={p.title} path={path} />
            ) : (
              <button className="btn btn-lg w-full btn-ghost" disabled>모집이 마감됐어요</button>
            )}
          </div>
        </div>
      ) : null}
      <Toast message={toast} />
    </>
  );
}
