"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "./db";
import {
  ensureDeviceHash, getDeviceHash, getIpHash, hashSecret, verifySecret, clearDevice,
  isAdmin, loginAdmin, logoutAdmin, randomTempSecret,
} from "./security";
import { allow, hit, secretLockRemaining } from "./rate";
import { parseApplyForm, parsePostForm, validateNickname, validateSecret, formValues, type FieldErrors } from "./validation";
import { closeExpiredPosts, logEvent, settlePendingOnClose } from "./data";
import { REPORT_REASONS } from "./constants";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  values?: Record<string, string | string[]>;
  data?: Record<string, string>;
};

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

async function grant(deviceHash: string, targetType: "post" | "application", targetId: string, role: "author" | "applicant") {
  await sql`insert into grants (device_hash, target_type, target_id, role)
    values (${deviceHash}, ${targetType}, ${targetId}, ${role})
    on conflict (device_hash, target_type, target_id) do nothing`;
}

async function isAuthor(postId: string): Promise<boolean> {
  const d = await getDeviceHash();
  if (!d || !isUuid(postId)) return false;
  const r = await sql`select 1 from grants where device_hash = ${d} and target_type = 'post' and target_id = ${postId}`;
  return r.length > 0;
}

async function isApplicant(appId: string): Promise<boolean> {
  const d = await getDeviceHash();
  if (!d || !isUuid(appId)) return false;
  const r = await sql`select 1 from grants where device_hash = ${d} and target_type = 'application' and target_id = ${appId}`;
  return r.length > 0;
}

async function news(targetType: "post" | "application", id: string, code: string, message: string) {
  await sql`insert into news (target_type, target_id, code, message) values (${targetType}, ${id}, ${code}, ${message})`;
}

/* ── 모집글 ───────────────────────────────────────── */

export async function createPost(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  const { input, errors } = parsePostForm(fd, { isEdit: false });
  const nickname = String(fd.get("nickname") ?? "").trim();
  const secret = String(fd.get("secret") ?? "");
  const secret2 = String(fd.get("secretConfirm") ?? "");
  const n = validateNickname(nickname);
  if (n) errors.nickname = n;
  const s = validateSecret(secret);
  if (s) errors.secret = s;
  else if (secret !== secret2) errors.secretConfirm = "비밀번호가 서로 달라요";
  if (Object.keys(errors).length) return { errors, values };

  const ip = await getIpHash();
  if (!(await allow(ip, "post", [{ perMinutes: 1, max: 1 }, { perMinutes: 60 * 24, max: 10 }]))) {
    return { message: "잠시 후 다시 올려 주세요. 짧은 시간에 너무 많은 글을 올렸어요.", values };
  }
  const dup = await sql`select 1 from posts where created_ip_hash = ${ip} and title = ${input.title} and created_at > now() - interval '1 minute'`;
  if (dup.length) return { message: "같은 글이 방금 올라갔어요.", values };

  const device = await ensureDeviceHash();
  const hash = await hashSecret(secret);
  const [row] = await sql<{ id: string }[]>`
    insert into posts (author_nickname, manage_secret_hash, title, category, tags, mode, region_sido, region_sigungu,
      online_tool, days, time_slots, start_date, duration_weeks, capacity, deadline, level, description, contact_url, created_ip_hash)
    values (${nickname}, ${hash}, ${input.title}, ${input.category}, ${input.tags}, ${input.mode}, ${input.regionSido},
      ${input.regionSigungu}, ${input.onlineTool}, ${input.days}, ${input.timeSlots}, ${input.startDate},
      ${input.durationWeeks}, ${input.capacity}, ${input.deadline}, ${input.level}, ${input.description},
      ${input.contactUrl}, ${ip})
    returning id`;
  await grant(device, "post", row.id, "author");
  await hit(ip, "post");
  await logEvent("post_created", device, {
    post_id: row.id, category: input.category, mode: input.mode, capacity: input.capacity,
  });
  revalidatePath("/");
  redirect(`/posts/${row.id}?created=1`);
}

export async function updatePost(postId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  if (!(await isAuthor(postId))) return { message: "이 글을 고칠 권한이 없어요. '내 글 관리'에서 비밀번호를 확인해 주세요.", values };
  const cur = await sql<{ status: string; title: string; mode: string; region_sido: string | null; region_sigungu: string | null; days: string[]; time_slots: string[]; start_date: string; capacity: number; contact_url: string; accepted: number }[]>`
    select status, title, mode, region_sido, region_sigungu, days, time_slots, to_char(start_date,'YYYY-MM-DD') start_date, capacity, contact_url,
      (select count(*)::int from applications a where a.post_id = posts.id and a.status = 'accepted') accepted
    from posts where id = ${postId}`;
  if (!cur[0] || !["recruiting", "closed"].includes(cur[0].status)) return { message: "지금은 고칠 수 없는 글이에요.", values };
  const c = cur[0];
  const { input, errors } = parsePostForm(fd, { isEdit: true, minCapacity: c.accepted + 1 });
  if (Object.keys(errors).length) return { errors, values };

  await sql.begin(async (tx) => {
    await tx`update posts set title = ${input.title}, category = ${input.category}, tags = ${input.tags}, mode = ${input.mode},
      region_sido = ${input.regionSido}, region_sigungu = ${input.regionSigungu}, online_tool = ${input.onlineTool},
      days = ${input.days}, time_slots = ${input.timeSlots}, start_date = ${input.startDate}, duration_weeks = ${input.durationWeeks},
      capacity = ${input.capacity}, deadline = ${input.deadline}, level = ${input.level}, description = ${input.description},
      contact_url = ${input.contactUrl}, updated_at = now() where id = ${postId}`;

    const keyChanged =
      c.mode !== input.mode || c.region_sido !== input.regionSido || c.region_sigungu !== input.regionSigungu ||
      c.days.join() !== input.days.join() || c.time_slots.join() !== input.timeSlots.join() || c.start_date !== input.startDate;
    const linkChanged = c.contact_url !== input.contactUrl;
    if (keyChanged || linkChanged) {
      const targets = await tx<{ id: string; status: string }[]>`select id, status from applications where post_id = ${postId} and status in ('pending','accepted')`;
      for (const a of targets) {
        if (keyChanged) await tx`insert into news (target_type, target_id, code, message) values ('application', ${a.id}, 'N-08', ${`「${input.title}」의 일정·방식·지역이 바뀌었어요`})`;
        if (linkChanged && a.status === "accepted") await tx`insert into news (target_type, target_id, code, message) values ('application', ${a.id}, 'N-13', ${`「${input.title}」의 연락방 링크가 바뀌었어요`})`;
      }
    }
    // 정원을 늘려 자리가 생겼고 마감일 전이면 다시 모집 (BR-013과 같은 규칙)
    if (c.status === "closed" && input.capacity - 1 > c.accepted) {
      await tx`update posts set status = 'recruiting', closed_reason = null
        where id = ${postId} and closed_reason = 'full' and ((deadline + 1)::timestamp at time zone 'Asia/Seoul') > now()`;
    }
    // 정원을 줄여 꽉 찼다면 마감
    if (input.capacity - 1 <= c.accepted && c.status === "recruiting") {
      await tx`update posts set status = 'closed', closed_reason = 'full' where id = ${postId}`;
      await settlePendingOnClose(tx, postId, input.title);
    }
  });
  revalidatePath(`/posts/${postId}`);
  redirect(`/posts/${postId}?updated=1`);
}

export async function closePost(postId: string): Promise<FormState> {
  if (!(await isAuthor(postId))) return { message: "권한이 없어요." };
  const done = await sql.begin(async (tx) => {
    const r = await tx<{ title: string }[]>`update posts set status = 'closed', closed_reason = 'manual', updated_at = now()
      where id = ${postId} and status = 'recruiting' returning title`;
    if (!r.length) return false;
    await settlePendingOnClose(tx, postId, r[0].title);
    return true;
  });
  if (done) await logEvent("post_closed", await getDeviceHash(), { post_id: postId, reason: "manual" });
  revalidatePath(`/posts/${postId}`);
  return { ok: done, message: done ? "모집을 마감했어요." : "이미 마감된 글이에요." };
}

export async function finishPost(postId: string): Promise<FormState> {
  if (!(await isAuthor(postId))) return { message: "권한이 없어요." };
  await sql`update posts set status = 'finished', updated_at = now() where id = ${postId} and status = 'closed'`;
  revalidatePath(`/posts/${postId}`);
  return { ok: true, message: "완주를 축하해요! 함께해서 가능했어요." };
}

export async function deletePost(postId: string): Promise<FormState> {
  if (!(await isAuthor(postId))) return { message: "권한이 없어요." };
  const res = await sql.begin(async (tx) => {
    const p = await tx<{ title: string; accepted: number }[]>`
      select title, (select count(*)::int from applications a where a.post_id = posts.id and a.status = 'accepted') accepted
      from posts where id = ${postId} for update`;
    if (!p[0]) return "missing";
    if (p[0].accepted > 0) return "has_accepted";
    await tx`update posts set status = 'deleted', updated_at = now() where id = ${postId}`;
    const pend = await tx<{ id: string }[]>`update applications set status = 'post_deleted', updated_at = now()
      where post_id = ${postId} and status = 'pending' returning id`;
    for (const a of pend) await tx`insert into news (target_type, target_id, code, message) values ('application', ${a.id}, 'N-09', ${`「${p[0].title}」 모집글이 삭제됐어요`})`;
    return "ok";
  });
  if (res === "has_accepted") return { message: "참여자가 있어 삭제할 수 없어요. 대신 '스터디 종료'를 이용해 주세요." };
  revalidatePath("/");
  redirect("/?deleted=1");
}

/* ── 지원 ─────────────────────────────────────────── */

export async function applyToPost(postId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  if (!isUuid(postId)) return { message: "잘못된 요청이에요." };
  const { nickname, message, secret, errors } = parseApplyForm(fd);
  if (Object.keys(errors).length) return { errors, values };

  const ip = await getIpHash();
  if (!(await allow(ip, "apply", [{ perMinutes: 1, max: 3 }]))) return { message: "잠시 후 다시 시도해 주세요.", values };

  await closeExpiredPosts();
  const device = await ensureDeviceHash();
  if (await isAuthor(postId)) return { message: "내가 올린 글에는 지원할 수 없어요.", values };

  const hash = await hashSecret(secret);
  const result = await sql.begin(async (tx) => {
    const p = await tx<{ status: string; title: string; author_nickname: string; created_at: Date }[]>`
      select status, title, author_nickname, created_at from posts where id = ${postId} for update`;
    if (!p[0] || p[0].status !== "recruiting") return { err: "방금 모집이 마감됐어요." };
    if (p[0].author_nickname.toLowerCase() === nickname.toLowerCase()) return { err: "방장과 같은 닉네임은 쓸 수 없어요.", field: "nickname" };
    const mine = await tx`select 1 from applications a join grants g on g.target_type='application' and g.target_id = a.id
      where a.post_id = ${postId} and g.device_hash = ${device}`;
    if (mine.length) return { err: "이 브라우저로 이미 지원한 글이에요." };
    const same = await tx`select 1 from applications where post_id = ${postId} and lower(applicant_nickname) = lower(${nickname}) and status in ('pending','accepted')`;
    if (same.length) return { err: "이 글에서 이미 쓰고 있는 닉네임이에요.", field: "nickname" };
    const [a] = await tx<{ id: string }[]>`insert into applications (post_id, applicant_nickname, message, check_secret_hash, created_ip_hash)
      values (${postId}, ${nickname}, ${message}, ${hash}, ${ip}) returning id`;
    await tx`insert into grants (device_hash, target_type, target_id, role) values (${device}, 'application', ${a.id}, 'applicant')`;
    await tx`insert into news (target_type, target_id, code, message) values ('post', ${postId}, 'N-01', ${`${nickname}님이 「${p[0].title}」에 손 들었어요`})`;
    return { id: a.id, minutes: Math.round((Date.now() - p[0].created_at.getTime()) / 60000) };
  });
  if ("err" in result) {
    return result.field ? { errors: { [result.field]: result.err! }, values } : { message: result.err, values };
  }
  await hit(ip, "apply");
  await logEvent("application_submitted", device, { post_id: postId, application_id: result.id, minutes_since_post_created: result.minutes });
  // 완료 안내 시트를 먼저 보여 주고, 시트를 닫을 때 화면을 새로 그린다 (ApplySheet onClose)
  return { ok: true, message: "지원했어요" };
}

export async function cancelApplication(appId: string): Promise<FormState> {
  if (!(await isApplicant(appId))) return { message: "권한이 없어요." };
  const r = await sql.begin(async (tx) => {
    const a = await tx<{ status: string; post_id: string; title: string; nick: string; deadline_passed: boolean; pstatus: string; closed_reason: string | null }[]>`
      select a.status, a.post_id, p.title, a.applicant_nickname nick, p.status pstatus, p.closed_reason,
        (((p.deadline + 1)::timestamp at time zone 'Asia/Seoul') <= now()) deadline_passed
      from applications a join posts p on p.id = a.post_id where a.id = ${appId} for update of a, p`;
    if (!a[0] || !["pending", "accepted"].includes(a[0].status)) return null;
    await tx`update applications set status = 'cancelled', updated_at = now() where id = ${appId}`;
    if (a[0].status === "accepted") {
      await tx`insert into news (target_type, target_id, code, message) values ('post', ${a[0].post_id}, 'N-06', ${`${a[0].nick}님이 「${a[0].title}」 참여를 취소했어요`})`;
      if (a[0].pstatus === "closed" && a[0].closed_reason === "full" && !a[0].deadline_passed) {
        await tx`update posts set status = 'recruiting', closed_reason = null, updated_at = now() where id = ${a[0].post_id}`;
        await tx`insert into news (target_type, target_id, code, message) values ('post', ${a[0].post_id}, 'N-14', '자리가 생겨 모집을 다시 열었어요')`;
        await tx`insert into events (name, props) values ('post_reopened', ${tx.json({ post_id: a[0].post_id })})`;
      }
    }
    return { prev: a[0].status, postId: a[0].post_id };
  });
  if (!r) return { message: "이미 처리된 지원이에요." };
  await logEvent("application_cancelled", await getDeviceHash(), { application_id: appId, prev_status: r.prev, by: "applicant" });
  revalidatePath(`/posts/${r.postId}`);
  return { ok: true, message: r.prev === "accepted" ? "참여를 취소했어요." : "손 든 걸 취소했어요." };
}

export async function decideApplication(appId: string, decision: "accept" | "reject", _prev: FormState, fd?: FormData): Promise<FormState> {
  if (!isUuid(appId)) return { message: "잘못된 요청이에요." };
  const a0 = await sql<{ post_id: string }[]>`select post_id from applications where id = ${appId}`;
  if (!a0[0] || !(await isAuthor(a0[0].post_id))) return { message: "권한이 없어요." };
  const postId = a0[0].post_id;
  const reason = String(fd?.get("reason") ?? "").trim().slice(0, 100) || null;
  const visible = fd?.get("reasonVisible") === "on";

  const r = await sql.begin(async (tx) => {
    // 정원 초과를 막기 위해 글 행을 잠그고 남은 자리를 센다 (NFR-005, EC-01)
    const p = await tx<{ status: string; title: string; capacity: number; created: Date }[]>`
      select status, title, capacity, created_at created from posts where id = ${postId} for update`;
    const a = await tx<{ status: string; nick: string; created_at: Date }[]>`
      select status, applicant_nickname nick, created_at from applications where id = ${appId} for update`;
    if (!a[0] || a[0].status !== "pending") return { err: "이미 처리된 지원이에요." };
    if (decision === "accept") {
      if (p[0].status !== "recruiting") return { err: "모집이 마감된 글이에요." };
      const acc = await tx<{ c: number }[]>`select count(*)::int c from applications where post_id = ${postId} and status = 'accepted'`;
      if (acc[0].c >= p[0].capacity - 1) return { err: "정원이 다 찼어요." };
      await tx`update applications set status = 'accepted', decided_at = now(), updated_at = now() where id = ${appId}`;
      await tx`insert into news (target_type, target_id, code, message) values ('application', ${appId}, 'N-02', ${`「${p[0].title}」 오늘부터 우리 편! 연락방에서 인사해요`})`;
      let closedNow = false;
      if (acc[0].c + 1 >= p[0].capacity - 1) {
        await tx`update posts set status = 'closed', closed_reason = 'full', updated_at = now() where id = ${postId}`;
        await settlePendingOnClose(tx, postId, p[0].title);
        await tx`insert into events (name, props) values ('post_closed', ${tx.json({ post_id: postId, reason: "full", accepted_count: acc[0].c + 1 })})`;
        closedNow = true;
      }
      return { ok: true, closedNow, hours: (Date.now() - a[0].created_at.getTime()) / 3_600_000 };
    } else {
      await tx`update applications set status = 'rejected', reject_reason = ${reason}, reason_visible = ${visible}, decided_at = now(), updated_at = now() where id = ${appId}`;
      const msg = `「${p[0].title}」은 이번엔 함께하기 어려워요. 다른 스터디도 있어요${visible && reason ? ` · 방장 메모: ${reason}` : ""}`;
      await tx`insert into news (target_type, target_id, code, message) values ('application', ${appId}, 'N-03', ${msg})`;
      return { ok: true, closedNow: false, hours: (Date.now() - a[0].created_at.getTime()) / 3_600_000 };
    }
  });
  if ("err" in r) return { message: r.err };
  await logEvent("application_decided", await getDeviceHash(), {
    application_id: appId, result: decision === "accept" ? "accepted" : "rejected", hours_since_submitted: Math.round(r.hours * 10) / 10,
  });
  revalidatePath(`/posts/${postId}/applicants`);
  return {
    ok: true,
    message: decision === "accept" ? (r.closedNow ? "함께하기로 했어요. 자리가 다 차서 모집이 마감됐어요." : "함께하기로 했어요.") : "다음에 함께하자고 전했어요.",
    data: decision === "accept" ? { undo: appId } : undefined,
  };
}

/** 수락 직후 되돌리기 (FR-007, 30초 이내·마감으로 다른 지원이 정리되지 않은 경우만) */
export async function undoAccept(appId: string): Promise<FormState> {
  const a0 = await sql<{ post_id: string }[]>`select post_id from applications where id = ${appId}`;
  if (!a0[0] || !(await isAuthor(a0[0].post_id))) return { message: "권한이 없어요." };
  const postId = a0[0].post_id;
  const ok = await sql.begin(async (tx) => {
    const p = await tx<{ status: string; closed_reason: string | null }[]>`select status, closed_reason from posts where id = ${postId} for update`;
    const a = await tx<{ status: string; decided_at: Date }[]>`select status, decided_at from applications where id = ${appId} for update`;
    if (!a[0] || a[0].status !== "accepted" || Date.now() - a[0].decided_at.getTime() > 30_000) return false;
    await tx`update applications set status = 'pending', decided_at = null, updated_at = now() where id = ${appId}`;
    await tx`delete from news where target_type = 'application' and target_id = ${appId} and code = 'N-02' and created_at > now() - interval '1 minute'`;
    if (p[0].status === "closed" && p[0].closed_reason === "full") {
      // 자동 마감으로 미선정 처리된 지원을 되살린다
      const revived = await tx<{ id: string }[]>`update applications set status = 'pending', decided_at = null, updated_at = now()
        where post_id = ${postId} and status = 'not_selected' and decided_at > now() - interval '1 minute' returning id`;
      for (const r of revived) await tx`delete from news where target_type='application' and target_id = ${r.id} and code = 'N-04' and created_at > now() - interval '1 minute'`;
      await tx`update posts set status = 'recruiting', closed_reason = null, updated_at = now() where id = ${postId}`;
    }
    return true;
  });
  revalidatePath(`/posts/${postId}/applicants`);
  return ok ? { ok: true, message: "되돌렸어요." } : { message: "되돌릴 수 있는 시간이 지났어요." };
}

export async function removeParticipant(appId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const reason = String(fd.get("reason") ?? "").trim();
  if ([...reason].length < 2 || [...reason].length > 100) return { errors: { reason: "사유를 2~100자로 적어 주세요" } };
  const a0 = await sql<{ post_id: string }[]>`select post_id from applications where id = ${appId}`;
  if (!a0[0] || !(await isAuthor(a0[0].post_id))) return { message: "권한이 없어요." };
  const postId = a0[0].post_id;
  await sql.begin(async (tx) => {
    const r = await tx<{ title: string }[]>`update applications a set status = 'removed', reject_reason = ${reason}, reason_visible = true, updated_at = now()
      from posts p where a.id = ${appId} and a.status = 'accepted' and p.id = a.post_id returning p.title`;
    if (r.length) await tx`insert into news (target_type, target_id, code, message) values ('application', ${appId}, 'N-07', ${`「${r[0].title}」에서 내보내졌어요 · 사유: ${reason}`})`;
  });
  await logEvent("application_cancelled", await getDeviceHash(), { application_id: appId, prev_status: "accepted", by: "author" });
  revalidatePath(`/posts/${postId}/applicants`);
  return { ok: true, message: "내보냈어요." };
}

/* ── 다른 기기에서 확인 (UF-1 4번) ─────────────────── */

export async function verifyAuthor(postId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  if (!isUuid(postId)) return { message: "잘못된 요청이에요." };
  const secret = String(fd.get("secret") ?? "");
  const ip = await getIpHash();
  const scope = `post:${postId}`;
  const lock = await secretLockRemaining(ip, scope);
  if (lock) return { message: `비밀번호를 여러 번 틀렸어요. ${lock}분 뒤에 다시 시도해 주세요.` };
  const p = await sql<{ manage_secret_hash: string }[]>`select manage_secret_hash from posts where id = ${postId} and status <> 'deleted'`;
  if (!p[0] || !(await verifySecret(secret, p[0].manage_secret_hash))) {
    await hit(ip, "secret_fail", scope);
    await logEvent("secret_check_failed", null, { target_type: "post" });
    return { errors: { secret: "비밀번호가 맞지 않아요" } };
  }
  const device = await ensureDeviceHash();
  await grant(device, "post", postId, "author");
  revalidatePath(`/posts/${postId}`);
  return { ok: true, message: "확인했어요. 이제 이 브라우저에서 글을 관리할 수 있어요." };
}

export async function verifyApplicant(postId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  if (!isUuid(postId)) return { message: "잘못된 요청이에요." };
  const nickname = String(fd.get("nickname") ?? "").trim();
  const secret = String(fd.get("secret") ?? "");
  const ip = await getIpHash();
  const scope = `apply:${postId}`;
  const lock = await secretLockRemaining(ip, scope);
  if (lock) return { message: `비밀번호를 여러 번 틀렸어요. ${lock}분 뒤에 다시 시도해 주세요.`, values: { nickname } };
  const rows = await sql<{ id: string; check_secret_hash: string }[]>`
    select id, check_secret_hash from applications where post_id = ${postId} and lower(applicant_nickname) = lower(${nickname})
    order by (status in ('pending','accepted')) desc, created_at desc`;
  let found: string | null = null;
  for (const r of rows) {
    if (await verifySecret(secret, r.check_secret_hash)) { found = r.id; break; }
  }
  if (!found) {
    await hit(ip, "secret_fail", scope);
    await logEvent("secret_check_failed", null, { target_type: "application" });
    return { errors: { secret: "닉네임 또는 비밀번호가 맞지 않아요" }, values: { nickname } };
  }
  const device = await ensureDeviceHash();
  await grant(device, "application", found, "applicant");
  await logEvent("my_application_viewed", device, { application_id: found, via: "secret" });
  revalidatePath(`/posts/${postId}`);
  return { ok: true, message: "확인했어요." };
}

export async function forgetThisBrowser(): Promise<FormState> {
  await clearDevice();
  revalidatePath("/", "layout");
  return { ok: true, message: "이 브라우저의 기록을 지웠어요." };
}

/* ── 신고 (FR-014) ────────────────────────────────── */

export async function reportPost(postId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const reason = String(fd.get("reason") ?? "");
  if (!(reason in REPORT_REASONS)) return { errors: { reason: "사유를 골라 주세요" } };
  const memo = String(fd.get("memo") ?? "").trim().slice(0, 100) || null;
  const ip = await getIpHash();
  if (!(await allow(ip, "report", [{ perMinutes: 60 * 24, max: 20 }]))) return { message: "오늘은 더 신고할 수 없어요." };
  const r = await sql.begin(async (tx) => {
    const ins = await tx`insert into reports (post_id, reason, memo, reporter_ip_hash) values (${postId}, ${reason}, ${memo}, ${ip})
      on conflict (post_id, reporter_ip_hash) do nothing returning id`;
    if (!ins.length) return "dup";
    const c = await tx<{ c: number }[]>`select count(distinct reporter_ip_hash)::int c from reports where post_id = ${postId} and status = 'open'`;
    await tx`update posts set report_count = ${c[0].c} where id = ${postId}`;
    if (c[0].c >= 3) {
      const h = await tx<{ title: string }[]>`update posts set status_before_hidden = status, status = 'hidden', updated_at = now()
        where id = ${postId} and status in ('recruiting','closed','finished') returning title`;
      if (h.length) {
        await tx`insert into news (target_type, target_id, code, message) values ('post', ${postId}, 'N-10', ${`「${h[0].title}」이 신고가 쌓여 운영자 확인 전까지 숨겨졌어요`})`;
        await tx`insert into events (name, props) values ('post_hidden', ${tx.json({ post_id: postId, by: "auto" })})`;
      }
    }
    return "ok";
  });
  await hit(ip, "report");
  await logEvent("report_submitted", null, { reason });
  return r === "dup" ? { message: "이미 신고한 글이에요." } : { ok: true, message: "신고했어요. 운영자가 확인할게요." };
}

/* ── 운영자 (FR-016, FR-022) ──────────────────────── */

export async function adminLogin(_prev: FormState, fd: FormData): Promise<FormState> {
  const ip = await getIpHash();
  const lock = await secretLockRemaining(ip, "admin");
  if (lock) return { message: `${lock}분 뒤에 다시 시도해 주세요.` };
  if (!(await loginAdmin(String(fd.get("password") ?? "")))) {
    await hit(ip, "secret_fail", "admin");
    return { errors: { password: process.env.ADMIN_PASSWORD ? "비밀번호가 맞지 않아요" : "ADMIN_PASSWORD 환경변수가 설정되지 않았어요" } };
  }
  redirect("/admin");
}

export async function adminLogout() {
  await logoutAdmin();
  redirect("/");
}

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("운영자 권한이 필요해요");
}

export async function adminSetHidden(postId: string, hidden: boolean): Promise<FormState> {
  await requireAdmin();
  if (hidden) {
    await sql`update posts set status_before_hidden = status, status = 'hidden', updated_at = now() where id = ${postId} and status <> 'hidden' and status <> 'deleted'`;
    await news("post", postId, "N-10", "운영 정책에 따라 글이 숨겨졌어요");
    await logEvent("post_hidden", null, { post_id: postId, by: "admin" });
  } else {
    await sql`update posts set status = coalesce(status_before_hidden, 'closed'), status_before_hidden = null, updated_at = now() where id = ${postId} and status = 'hidden'`;
    await sql`update reports set status = 'resolved' where post_id = ${postId}`;
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function adminResetSecret(kind: "post" | "application", id: string): Promise<FormState> {
  await requireAdmin();
  const temp = randomTempSecret();
  const hash = await hashSecret(temp);
  if (kind === "post") await sql`update posts set manage_secret_hash = ${hash} where id = ${id}`;
  else await sql`update applications set check_secret_hash = ${hash} where id = ${id}`;
  return { ok: true, message: `임시 비밀번호: ${temp}`, data: { temp } };
}

export async function adminDeleteAll(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  if (String(fd.get("confirm") ?? "") !== "전체 삭제") return { errors: { confirm: "'전체 삭제'라고 정확히 적어 주세요" } };
  await sql.begin(async (tx) => {
    // 집계용 익명 수치만 남기고 원본은 모두 지운다 (BR-019)
    const counts = await tx<{ posts: number; apps: number }[]>`select (select count(*)::int from posts) posts, (select count(*)::int from applications) apps`;
    await tx`insert into events (name, props) values ('pilot_data_deleted', ${tx.json(counts[0])})`;
    await tx`delete from reports`;
    await tx`delete from news`;
    await tx`delete from grants`;
    await tx`delete from applications`;
    await tx`delete from posts`;
    await tx`delete from rate_events`;
    await tx`update events set anon_id = null, props = props - 'post_id' - 'application_id'`;
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "모든 글·지원·신고 데이터를 지웠어요." };
}
