import { closeExpiredPosts } from "@/lib/data";

// Vercel Cron이 호출하는 마감 배치 (FR-009). 조회 시점에도 같은 처리를 하므로 실패해도 괜찮다.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const closed = await closeExpiredPosts();
  return Response.json({ closed });
}
