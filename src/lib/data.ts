import "server-only";
import { sql } from "./db";
import { PAGE_SIZE } from "./constants";

export type PostRow = {
  id: string;
  author_nickname: string;
  title: string;
  category: string;
  tags: string[];
  mode: "online" | "offline" | "hybrid";
  region_sido: string | null;
  region_sigungu: string | null;
  online_tool: string | null;
  days: string[];
  time_slots: string[];
  start_date: string;
  duration_weeks: number | null;
  capacity: number;
  deadline: string;
  level: string | null;
  description: string;
  status: string;
  closed_reason: string | null;
  created_at: Date;
  updated_at: Date;
  accepted_count: number;
  pending_count: number;
};

export type ApplicationRow = {
  id: string;
  post_id: string;
  applicant_nickname: string;
  message: string;
  status: string;
  reject_reason: string | null;
  reason_visible: boolean;
  decided_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

/** 공개 필드만 고르는 SELECT 목록 (BR-016). contact_url·해시는 절대 넣지 않는다 */
const publicCols = () => sql`
  p.id, p.author_nickname, p.title, p.category, p.tags, p.mode, p.region_sido, p.region_sigungu,
  p.online_tool, p.days, p.time_slots, to_char(p.start_date,'YYYY-MM-DD') as start_date,
  p.duration_weeks, p.capacity, to_char(p.deadline,'YYYY-MM-DD') as deadline, p.level,
  p.description, p.status, p.closed_reason, p.created_at, p.updated_at,
  (select count(*)::int from applications a where a.post_id = p.id and a.status = 'accepted') as accepted_count,
  (select count(*)::int from applications a where a.post_id = p.id and a.status = 'pending') as pending_count
`;

/**
 * 마감일이 지난 모집글을 닫는다 (FR-009). 배치(cron)가 실패해도 조회 시점에 처리되도록
 * 주요 조회 전에 호출한다. 마감일 23:59:59 KST가 지나면 마감.
 */
export async function closeExpiredPosts(): Promise<number> {
  return sql.begin(async (tx) => {
    const closed = await tx<{ id: string; title: string }[]>`
      update posts set status = 'closed', closed_reason = 'deadline', updated_at = now()
      where status = 'recruiting'
        and ((deadline + 1)::timestamp at time zone 'Asia/Seoul') <= now()
      returning id, title`;
    for (const p of closed) {
      await settlePendingOnClose(tx, p.id, p.title);
      const acc = await tx<{ c: number }[]>`select count(*)::int c from applications where post_id = ${p.id} and status = 'accepted'`;
      await tx`insert into news (target_type, target_id, code, message) values
        ('post', ${p.id}, ${acc[0].c === 0 ? "N-11" : "N-12"},
         ${acc[0].c === 0 ? `「${p.title}」이 지원자 없이 마감됐어요. 복제해서 다시 올릴 수 있어요` : `「${p.title}」 모집이 마감일에 마감됐어요`})`;
      await tx`insert into events (name, props) values ('post_closed', ${tx.json({ post_id: p.id, reason: "deadline", accepted_count: acc[0].c })})`;
    }
    return closed.length;
  });
}

/** 마감 시 남은 대기 지원을 미선정 처리하고 새 소식을 남긴다 (BR-004) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function settlePendingOnClose(tx: any, postId: string, title: string) {
  const left = await tx`
    update applications set status = 'not_selected', decided_at = now(), updated_at = now()
    where post_id = ${postId} and status = 'pending' returning id`;
  for (const a of left) {
    await tx`insert into news (target_type, target_id, code, message)
      values ('application', ${a.id}, 'N-04', ${`「${title}」은 자리가 다 찼어요. 다른 스터디도 둘러봐요`})`;
  }
}

export type BoardFilters = {
  q?: string;
  category?: string[];
  mode?: string[];
  sido?: string;
  sigungu?: string;
  days?: string[];
  slots?: string[];
  level?: string;
  sort?: "latest" | "deadline" | "seats";
  includeClosed?: boolean;
  page?: number;
};

export async function listPosts(f: BoardFilters) {
  const page = Math.max(1, f.page ?? 1);
  const limit = PAGE_SIZE * page; // "더 보기"는 누적해서 다시 그린다
  const statuses = f.includeClosed ? ["recruiting", "closed", "finished"] : ["recruiting"];
  // 진행 방식 "온라인"은 혼합도 포함 (FR-004)
  const modes = f.mode?.length
    ? Array.from(new Set(f.mode.flatMap((m) => (m === "online" || m === "offline" ? [m, "hybrid"] : [m]))))
    : null;
  const q = f.q && [...f.q].length >= 2 ? `%${f.q.replace(/[\\%_]/g, (m) => "\\" + m)}%` : null;

  const order =
    f.sort === "deadline"
      ? sql`case when p.status = 'recruiting' then 0 else 1 end, p.deadline asc, p.created_at desc`
      : f.sort === "seats"
        ? sql`case when p.status = 'recruiting' then 0 else 1 end, (p.capacity - 1 - (select count(*) from applications a where a.post_id = p.id and a.status='accepted')) desc, p.created_at desc`
        : sql`case when p.status = 'recruiting' then 0 else 1 end, p.created_at desc`;

  const rows = await sql<PostRow[]>`
    select ${publicCols()} from posts p
    where p.status in ${sql(statuses)}
      ${f.category?.length ? sql`and p.category in ${sql(f.category)}` : sql``}
      ${modes ? sql`and p.mode in ${sql(modes)}` : sql``}
      ${f.sido ? sql`and (p.mode = 'online' or p.region_sido = ${f.sido})` : sql``}
      ${f.sigungu ? sql`and (p.mode = 'online' or p.region_sigungu = ${f.sigungu})` : sql``}
      ${f.days?.length ? sql`and p.days && ${f.days}::text[]` : sql``}
      ${f.slots?.length ? sql`and p.time_slots && ${f.slots}::text[]` : sql``}
      ${f.level ? sql`and p.level = ${f.level}` : sql``}
      ${q ? sql`and (p.title ilike ${q} or p.description ilike ${q} or array_to_string(p.tags,' ') ilike ${q})` : sql``}
    order by ${order}
    limit ${limit + 1}`;
  return { posts: rows.slice(0, limit), hasMore: rows.length > limit, page };
}

export async function getPost(id: string): Promise<PostRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await sql<PostRow[]>`select ${publicCols()} from posts p where p.id = ${id}`;
  return rows[0] ?? null;
}

export async function getContactUrl(postId: string): Promise<string | null> {
  const r = await sql<{ contact_url: string }[]>`select contact_url from posts where id = ${postId}`;
  return r[0]?.contact_url ?? null;
}

export async function getGrants(deviceHash: string | null, targetType: "post" | "application", ids: string[]) {
  if (!deviceHash || ids.length === 0) return [] as { target_id: string; last_seen_at: Date }[];
  return sql<{ target_id: string; last_seen_at: Date }[]>`
    select target_id, last_seen_at from grants
    where device_hash = ${deviceHash} and target_type = ${targetType} and target_id in ${sql(ids)}`;
}

export async function hasGrant(deviceHash: string | null, targetType: "post" | "application", id: string) {
  if (!deviceHash) return false;
  const r = await sql`select 1 from grants where device_hash = ${deviceHash} and target_type = ${targetType} and target_id = ${id}`;
  return r.length > 0;
}

/** 이 브라우저가 이 글에 대해 가진 지원(활성 우선, 최신 순) */
export async function getMyApplicationForPost(deviceHash: string | null, postId: string) {
  if (!deviceHash) return null;
  const r = await sql<ApplicationRow[]>`
    select a.* from applications a
    join grants g on g.target_type = 'application' and g.target_id = a.id and g.device_hash = ${deviceHash}
    where a.post_id = ${postId}
    order by (a.status in ('pending','accepted')) desc, a.created_at desc limit 1`;
  return r[0] ?? null;
}

export async function listApplications(postId: string) {
  return sql<(ApplicationRow & { waiting_long: boolean })[]>`
    select *, (status = 'pending' and created_at < now() - interval '72 hours') as waiting_long from applications where post_id = ${postId}
    order by case status when 'pending' then 0 when 'accepted' then 1 else 2 end, created_at asc`;
}

export async function markSeen(deviceHash: string | null, targetType: "post" | "application", id: string) {
  if (!deviceHash) return;
  await sql`update grants set last_seen_at = now() where device_hash = ${deviceHash} and target_type = ${targetType} and target_id = ${id}`;
}

export async function unreadCount(deviceHash: string | null): Promise<number> {
  if (!deviceHash) return 0;
  const r = await sql<{ c: number }[]>`
    select count(*)::int c from news n
    join grants g on g.target_type = n.target_type and g.target_id = n.target_id
    where g.device_hash = ${deviceHash} and n.created_at > g.last_seen_at`;
  return r[0]?.c ?? 0;
}

export async function myActivity(deviceHash: string | null) {
  if (!deviceHash) return { posts: [], applications: [] };
  const posts = await sql<(PostRow & { unread: number })[]>`
    select ${publicCols()},
      (select count(*)::int from news n where n.target_type='post' and n.target_id = p.id and n.created_at > g.last_seen_at) as unread
    from grants g join posts p on p.id = g.target_id
    where g.device_hash = ${deviceHash} and g.target_type = 'post' and p.status <> 'deleted'
    order by p.created_at desc`;
  const applications = await sql<(ApplicationRow & { post_title: string; post_status: string; unread: number; latest_news: string | null })[]>`
    select a.*, p.title as post_title, p.status as post_status,
      (select count(*)::int from news n where n.target_type='application' and n.target_id = a.id and n.created_at > g.last_seen_at) as unread,
      (select n.message from news n where n.target_type='application' and n.target_id = a.id order by n.created_at desc limit 1) as latest_news
    from grants g join applications a on a.id = g.target_id join posts p on p.id = a.post_id
    where g.device_hash = ${deviceHash} and g.target_type = 'application'
    order by a.created_at desc`;
  return { posts, applications };
}

export async function latestNews(targetType: "post" | "application", id: string, since?: Date) {
  return sql<{ code: string; message: string; created_at: Date }[]>`
    select code, message, created_at from news
    where target_type = ${targetType} and target_id = ${id}
      ${since ? sql`and created_at > ${since}` : sql``}
    order by created_at desc limit 5`;
}

export async function logEvent(name: string, anonId: string | null, props: Record<string, unknown> = {}) {
  try {
    await sql`insert into events (name, anon_id, props) values (${name}, ${anonId ? anonId.slice(0, 16) : null}, ${sql.json(props as never)})`;
  } catch {
    // 이벤트 기록 실패가 기능을 막지 않는다 (§17)
  }
}
