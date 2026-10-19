import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { getDeviceHash } from "@/lib/security";
import { unreadCount } from "@/lib/data";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = {
  title: { default: "스터디보드", template: "%s · 스터디보드" },
  description: "가입 없이 링크 하나로 같이 공부할 사람을 찾는 스터디 모집 보드",
  robots: { index: false, follow: false }, // 커뮤니티 내부용 (BR-016, OQ-013)
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

async function Header() {
  let unread = 0;
  try {
    unread = await unreadCount(await getDeviceHash());
  } catch {
    unread = 0;
  }
  return (
    <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="mx-auto flex h-14 max-w-[720px] items-center justify-between px-4">
        <Link href="/" className="text-[19px] font-extrabold tracking-tight">
          스터디보드
        </Link>
        <nav aria-label="주요 메뉴" className="flex items-center gap-1">
          <Link href="/me" className="btn btn-ghost btn-sm relative !bg-transparent">
            내 활동
            {unread > 0 ? (
              <span className="ml-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-danger px-1.5 text-[12px] font-bold text-white" aria-label={`새 소식 ${unread}개`}>
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const del = process.env.PILOT_DELETE_DATE;
  return (
    <html lang="ko">
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 btn btn-primary btn-sm">본문으로 건너뛰기</a>
        {del && /^\d{4}-\d{2}-\d{2}$/.test(del) ? (
          <div className="bg-warning-soft text-warning text-[13px] font-semibold text-center px-4 py-2">
            테스트 서비스예요. {formatDate(del)}에 모든 내용이 삭제돼요.
          </div>
        ) : null}
        <Header />
        <main id="main" className="mx-auto w-full max-w-[720px] px-4 pb-32">
          {children}
        </main>
        <footer className="mx-auto max-w-[720px] px-4 pb-28 text-[13px] text-text-3">
          <Link href="/privacy" className="underline">개인정보 안내</Link>
          <span className="mx-2" aria-hidden>·</span>
          닉네임은 본인 확인이 되지 않아요. 연락방에서 한 번 더 확인해 주세요.
        </footer>
      </body>
    </html>
  );
}
