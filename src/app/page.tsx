import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { closeExpiredPosts, listPosts, logEvent, type BoardFilters } from "@/lib/data";
import { CATEGORIES } from "@/lib/constants";
import { PostCard } from "@/components/PostCard";
import { FilterSheet } from "@/components/FilterSheet";
import { Toast } from "@/components/client";
import { getDeviceHash } from "@/lib/security";

type SP = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function Board({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f: BoardFilters & { closed?: boolean } = {
    q: one(sp.q)?.slice(0, 40),
    category: arr(sp.category).filter((c) => (CATEGORIES as readonly string[]).includes(c)),
    mode: arr(sp.mode).filter((m) => m === "online" || m === "offline"),
    sido: one(sp.sido),
    sigungu: one(sp.sigungu)?.trim() || undefined,
    days: arr(sp.days),
    slots: arr(sp.slots),
    level: one(sp.level),
    sort: (one(sp.sort) as BoardFilters["sort"]) ?? "latest",
    includeClosed: one(sp.closed) === "1",
    closed: one(sp.closed) === "1",
    page: Number(one(sp.page) ?? 1) || 1,
  };
  const qTooShort = !!f.q && [...f.q].length < 2;

  await closeExpiredPosts();
  const { posts, hasMore, page } = await listPosts(f);
  const device = await getDeviceHash();
  await logEvent("board_viewed", device, { result_count: posts.length, filtered: Boolean(f.q || f.category?.length || f.mode?.length || f.sido || f.days?.length) });

  const activeCount =
    (f.category?.length ? 1 : 0) + (f.mode?.length ? 1 : 0) + (f.sido || f.sigungu ? 1 : 0) +
    (f.days?.length ? 1 : 0) + (f.slots?.length ? 1 : 0) + (f.level ? 1 : 0) + (f.closed ? 1 : 0) + (f.sort && f.sort !== "latest" ? 1 : 0);
  const filtered = activeCount > 0 || !!f.q;

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of arr(v)) if (k !== "page") params.append(k, x);
  const moreHref = `/?${new URLSearchParams([...params, ["page", String(page + 1)]]).toString()}`;
  const catHref = (c?: string) => {
    const p = new URLSearchParams(params);
    p.delete("category");
    if (c) p.append("category", c);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };
  const single = f.category?.length === 1 ? f.category[0] : undefined;

  return (
    <>
      <section className="pt-5 pb-4">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">
          같이 공부할 사람,<br />여기서 찾아요
        </h1>
        <p className="mt-2 text-text-2">가입 없이 글을 올리고 지원할 수 있어요.</p>
      </section>

      <form action="/" method="get" role="search" className="relative mb-3">
        {Object.entries(sp).flatMap(([k, v]) => (k === "q" || k === "page" ? [] : arr(v).map((x, i) => <input key={`${k}${i}`} type="hidden" name={k} value={x} />)))}
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-3" aria-hidden />
        <input name="q" defaultValue={f.q} className="input !pl-11 !bg-surface" placeholder="SQL, 토익, 포트폴리오…" aria-label="모집글 검색" enterKeyHint="search" />
      </form>
      {qTooShort ? <p className="field-error -mt-1 mb-3">2자 이상 입력해 주세요</p> : null}

      <div className="flex items-center gap-2 mb-4">
        <FilterSheet f={f} activeCount={activeCount} />
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mr-4 pr-4" aria-label="분야 빠른 선택">
          <Link href={catHref()} className={`btn btn-sm shrink-0 ${!f.category?.length ? "btn-primary" : "btn-ghost !bg-surface"}`} aria-current={!f.category?.length ? "true" : undefined}>전체</Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={catHref(c)} className={`btn btn-sm shrink-0 ${single === c ? "btn-primary" : "btn-ghost !bg-surface"}`} aria-current={single === c ? "true" : undefined}>
              {c}
            </Link>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="card p-8 text-center">
          {filtered ? (
            <>
              <p className="text-[18px] font-bold">조건에 맞는 모집글이 없어요</p>
              <p className="mt-1 text-text-2">조건을 줄이거나 직접 스터디를 열어 보세요.</p>
              <div className="mt-5 flex justify-center gap-2">
                <Link href="/" className="btn btn-ghost">필터 초기화</Link>
                <Link href="/posts/new" className="btn btn-primary">모집글 쓰기</Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-[18px] font-bold">아직 모집글이 없어요</p>
              <p className="mt-1 text-text-2">첫 스터디를 열어 보세요.</p>
              <Link href="/posts/new" className="btn btn-primary mt-5">모집글 쓰기</Link>
            </>
          )}
        </div>
      ) : (
        <ul className={`grid gap-3 ${page === 1 ? "stagger" : ""}`}>
          {posts.map((p) => <PostCard key={p.id} p={p} />)}
        </ul>
      )}

      {hasMore ? (
        <div className="mt-4">
          <Link href={moreHref} scroll={false} className="btn btn-ghost w-full !bg-surface">더 보기</Link>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 pointer-events-none">
        <div className="mx-auto max-w-[720px] px-4 safe-bottom flex justify-end">
          <Link href="/posts/new" className="btn btn-primary btn-lg pointer-events-auto shadow-[0_8px_24px_rgb(37_99_235_/_0.35)] !rounded-full !px-6">
            <Plus size={20} aria-hidden /> 모집글 쓰기
          </Link>
        </div>
      </div>
      <Toast message={one(sp.deleted) ? "모집글을 삭제했어요" : null} />
    </>
  );
}
