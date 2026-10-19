import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/security";
import { sql } from "@/lib/db";
import { adminDeleteAll, adminLogin, adminLogout, adminResetSecret, adminSetHidden } from "@/lib/actions";
import { AdminLoginForm, DeleteAllForm, ResetSecretButton } from "@/components/AdminUI";
import { ActionButton } from "@/components/actions-ui";
import { PostStatusBadge, AppStatusBadge } from "@/components/ui";
import { timeAgo } from "@/lib/time";
import { REPORT_REASONS } from "@/lib/constants";

export const metadata: Metadata = { title: "운영자" };

export default async function Admin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!(await isAdmin())) return <AdminLoginForm action={adminLogin} />;
  const { q = "" } = await searchParams;
  const like = q ? `%${q}%` : null;

  const stats = await sql<{ posts: number; recruiting: number; apps: number; success: number; reports: number }[]>`
    select (select count(*)::int from posts where status <> 'deleted') posts,
      (select count(*)::int from posts where status = 'recruiting') recruiting,
      (select count(*)::int from applications) apps,
      (select count(*)::int from posts p where p.status in ('closed','finished') and exists (select 1 from applications a where a.post_id = p.id and a.status = 'accepted')) success,
      (select count(*)::int from reports where status = 'open') reports`;
  const posts = await sql<{ id: string; title: string; author_nickname: string; status: string; deadline: string; report_count: number; created_at: Date }[]>`
    select id, title, author_nickname, status, to_char(deadline,'YYYY-MM-DD') deadline, report_count, created_at from posts
    where status <> 'deleted' ${like ? sql`and (title ilike ${like} or author_nickname ilike ${like})` : sql``}
    order by (status = 'hidden') desc, report_count desc, created_at desc limit 50`;
  const apps = like
    ? await sql<{ id: string; applicant_nickname: string; status: string; title: string; post_id: string }[]>`
        select a.id, a.applicant_nickname, a.status, p.title, a.post_id from applications a join posts p on p.id = a.post_id
        where a.applicant_nickname ilike ${like} order by a.created_at desc limit 30`
    : [];
  const reports = await sql<{ post_id: string; reason: string; memo: string | null; created_at: Date; title: string }[]>`
    select r.post_id, r.reason, r.memo, r.created_at, p.title from reports r join posts p on p.id = r.post_id
    where r.status = 'open' order by r.created_at desc limit 30`;
  const funnel = await sql<{ name: string; c: number }[]>`
    select name, count(*)::int c from events where created_at > now() - interval '7 days' group by name order by c desc`;

  return (
    <div className="pt-5 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-extrabold">운영자</h1>
        <form action={adminLogout}><button className="btn btn-ghost btn-sm">나가기</button></form>
      </div>

      <section className="card p-5 grid grid-cols-5 text-center gap-2">
        {[["글", stats[0].posts], ["모집 중", stats[0].recruiting], ["지원", stats[0].apps], ["성사", stats[0].success], ["미처리 신고", stats[0].reports]].map(([l, n]) => (
          <div key={l as string}><p className="text-[12px] text-text-3">{l}</p><p className="text-[20px] font-extrabold">{n}</p></div>
        ))}
      </section>

      <form className="flex gap-2" action="/admin">
        <input name="q" defaultValue={q} className="input !bg-surface" placeholder="제목·닉네임 검색 (비밀번호 초기화용)" />
        <button className="btn btn-primary">검색</button>
      </form>

      {reports.length ? (
        <section className="card p-5">
          <h2 className="font-bold mb-2">미처리 신고</h2>
          <ul className="divide-y divide-line text-[15px]">
            {reports.map((r, i) => (
              <li key={i} className="py-2.5">
                <Link className="underline font-semibold" href={`/posts/${r.post_id}`}>{r.title}</Link>
                <span className="text-text-3"> · {REPORT_REASONS[r.reason as keyof typeof REPORT_REASONS]}{r.memo ? ` · ${r.memo}` : ""} · {timeAgo(r.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card p-5">
        <h2 className="font-bold mb-3">모집글</h2>
        <ul className="divide-y divide-line">
          {posts.map((p) => (
            <li key={p.id} className="py-3 flex flex-wrap items-center gap-2">
              <PostStatusBadge status={p.status} />
              <Link href={`/posts/${p.id}`} className="font-semibold underline flex-1 min-w-40 truncate">{p.title}</Link>
              <span className="text-[13px] text-text-3">{p.author_nickname} · 신고 {p.report_count}</span>
              {p.status === "hidden" ? (
                <ActionButton action={adminSetHidden.bind(null, p.id, false)} className="btn btn-secondary btn-sm">숨김 해제</ActionButton>
              ) : (
                <ActionButton action={adminSetHidden.bind(null, p.id, true)} className="btn btn-danger btn-sm" confirmText="이 글을 숨길까요?">숨기기</ActionButton>
              )}
              <ResetSecretButton action={adminResetSecret.bind(null, "post", p.id)} label="관리 비밀번호" />
            </li>
          ))}
        </ul>
      </section>

      {apps.length ? (
        <section className="card p-5">
          <h2 className="font-bold mb-3">지원 (닉네임 검색 결과)</h2>
          <ul className="divide-y divide-line">
            {apps.map((a) => (
              <li key={a.id} className="py-3 flex flex-wrap items-center gap-2">
                <AppStatusBadge status={a.status} />
                <span className="font-semibold">{a.applicant_nickname}</span>
                <Link href={`/posts/${a.post_id}`} className="text-[14px] underline text-text-2 flex-1 truncate">{a.title}</Link>
                <ResetSecretButton action={adminResetSecret.bind(null, "application", a.id)} label="확인 비밀번호" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card p-5">
        <h2 className="font-bold mb-3">최근 7일 이벤트</h2>
        <ul className="grid grid-cols-2 gap-x-6 text-[14px]">
          {funnel.map((f) => <li key={f.name} className="flex justify-between py-1 border-b border-line"><span>{f.name}</span><b>{f.c}</b></li>)}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="font-bold mb-3 text-danger">파일럿 종료 처리</h2>
        <DeleteAllForm action={adminDeleteAll} />
      </section>
    </div>
  );
}
