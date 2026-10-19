import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import "./globals.css";
import { getDeviceHash } from "@/lib/security";
import { unreadCount } from "@/lib/data";
import { formatDate } from "@/lib/time";
import { Logo } from "@/components/Logo";


export const metadata: Metadata = {
  title: { default: "모여봄 · 혼자 말고, 모여 봄.", template: "%s · 모여봄" },
  description: "가입 없이 링크 하나로, 같이 공부할 사람을 찾아요.",
  robots: { index: false, follow: false }, // 커뮤니티 내부용 (BR-016, OQ-013)
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#171311" },
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
      <div className="mx-auto flex h-14 lg:h-16 max-w-[1120px] items-center justify-between px-4 lg:px-6">
        <Link href="/" aria-label="모여봄 홈">
          <Logo />
        </Link>
        <nav aria-label="주요 메뉴" className="flex items-center gap-1 lg:gap-2">
          <Link href="/me" className="btn btn-ghost btn-sm relative !bg-transparent">
            내 활동
            {unread > 0 ? (
              <span className="ml-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-danger px-1.5 text-[12px] font-bold text-white" aria-label={`새 소식 ${unread}개`}>
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
          <Link href="/posts/new" className="btn btn-primary btn-sm hidden lg:inline-flex">
            <Plus size={16} aria-hidden /> 모집글 쓰기
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
            시즌 1 테스트 중이에요. {formatDate(del)}에 모든 내용이 정리돼요.
          </div>
        ) : null}
        <Header />
        <main id="main" className="mx-auto w-full max-w-[1120px] px-4 lg:px-6 pb-32 lg:pb-16">
          {children}
        </main>
        <footer className="mx-auto max-w-[1120px] px-4 lg:px-6 pb-28 lg:pb-10 text-[13px] text-text-3">
          <p>
            <b className="text-text-2">모여봄</b> — 혼자 말고, 모여 봄.
            <span className="mx-2" aria-hidden>·</span>
            <Link href="/privacy" className="underline">개인정보 안내</Link>
          </p>
          <p className="mt-1">닉네임은 본인 확인이 되지 않아요. 연락방에서 한 번 더 확인해 주세요.</p>
        </footer>
      </body>
    </html>
  );
}
