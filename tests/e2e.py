import asyncio, re, subprocess, json, sys
from playwright.async_api import async_playwright, expect

import os
BASE = os.environ.get("BASE_URL", "http://localhost:3000")
SHOTS = os.environ.get("SHOTS_DIR", "/tmp")
CONTACT = "https://open.kakao.com/o/testRoom123"
results = []
def ok(name, cond, extra=""):
    results.append((name, bool(cond), extra)); print(("PASS" if cond else "FAIL"), name, extra, flush=True)

def psql(q):
    return subprocess.run(["psql", os.environ.get("DATABASE_URL", "postgresql://sb:sb@localhost:5432/studyboard"), "-Atc", q], capture_output=True, text=True).stdout.strip()

async def new_ctx(b, dark=False, ip="10.0.0.1"):
    return await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                               color_scheme="dark" if dark else "light", locale="ko-KR", extra_http_headers={"x-forwarded-for": ip})

async def fill_post(page, title, capacity="3", mode="offline"):
    await page.goto(BASE + "/posts/new")
    await page.fill("#nickname", "방장민수")
    await page.fill("#secret", "pass1234")
    await page.fill("#secretConfirm", "pass1234")
    await page.fill("#title", title)
    await page.locator("label.chip", has_text="AI·데이터").click()
    await page.fill("#tags", "SQL, 데이터")
    if mode == "offline":
        await page.locator("label.chip", has_text="오프라인").click()
        await page.select_option("#regionSido", "서울")
        await page.fill("#regionSigungu", "마포구")
    await page.locator("#f-days label.chip", has_text="수").click()
    await page.locator("#f-timeSlots label.chip", has_text="저녁").click()
    await page.select_option("#capacity", capacity)
    await page.fill("#description", "매주 수요일 저녁 8시에 모여서 SQL 문제를 같이 풀고 리뷰해요. 노트북 지참!")
    await page.fill("#contactUrl", CONTACT)
    await page.get_by_role("button", name="모집글 올리기").click()
    await page.wait_for_url(re.compile(r"/posts/[0-9a-f-]{36}"))
    return page.url.split("/posts/")[1].split("?")[0]

async def apply(page, pid, nick, secret="ap1234", msg="안녕하세요! 꾸준히 참여하고 싶어요. 수요일 저녁 가능합니다."):
    await page.goto(f"{BASE}/posts/{pid}")
    await page.get_by_role("button", name="같이 할래요", exact=True).click()
    dlg = page.locator("dialog[open]")
    await dlg.get_by_label("닉네임").fill(nick)
    await dlg.get_by_label("방장에게 한마디").fill(msg)
    await dlg.get_by_label("확인 비밀번호").fill(secret)
    await dlg.get_by_role("button", name="손 들기").click()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome" if False else None)
        author = await new_ctx(b, ip="10.0.0.1"); a = await author.new_page()
        errs = []
        a.on("pageerror", lambda e: errs.append(str(e)))

        # 0. 빈 보드
        await a.goto(BASE + "/")
        await a.screenshot(path=f"{SHOTS}/01_empty_board.png", full_page=True)

        # 1. 검증 실패 → 오류 요약
        await a.goto(BASE + "/posts/new")
        await a.get_by_role("button", name="모집글 올리기").click()
        summary = a.locator("#error-summary-title")
        await expect(summary).to_be_visible(timeout=8000)
        txt = await summary.inner_text()
        ok("검증 실패 시 오류 요약 표시", "확인해 주세요" in txt, txt[:40].replace("\n", " "))
        focused = await a.evaluate("document.activeElement?.getAttribute('aria-labelledby')")
        ok("오류 요약으로 포커스 이동", focused == "error-summary-title")
        await a.screenshot(path=f"{SHOTS}/02_form_errors.png", full_page=False)

        # 2. 글 작성
        pid = await fill_post(a, "퇴근 후 SQL 기초 4주 완주", capacity="3")
        ok("모집글 작성 후 상세 이동", len(pid) == 36)
        await expect(a.get_by_text("모집글이 올라갔어요")).to_be_visible()
        ok("작성자에게 관리 패널", await a.get_by_role("link", name=re.compile("손 든 사람")).count() == 1)
        ok("작성자에게 연락방 링크 보임", await a.get_by_text(CONTACT).count() >= 1)
        await a.screenshot(path=f"{SHOTS}/03_detail_author.png", full_page=True)

        # 같은 IP로 1분 내 재작성 → 제한
        await a.goto(BASE + "/posts/new")
        try:
            await fill_post(a, "두번째 글 제목입니다")
            ok("같은 IP 1분 내 재작성 제한", False)
        except Exception:
            ok("같은 IP 1분 내 재작성 제한", await a.get_by_text("잠시 후 다시 올려 주세요").count() > 0)

        # 3. 방문자: 연락 링크 숨김
        visitor = await new_ctx(b, ip="10.0.0.9"); v = await visitor.new_page()
        resp = await v.goto(f"{BASE}/posts/{pid}")
        html = await resp.text()
        ok("방문자 HTML에 연락 링크 없음", CONTACT not in html)
        ok("방문자 HTML에 해시 없음", "scrypt$" not in html)
        await v.get_by_role("button", name="같이 할래요", exact=True).wait_for()
        ok("로그인 없이 상세 열람 + 지원 버튼", await v.get_by_role("button", name="같이 할래요", exact=True).count() == 1)
        await v.screenshot(path=f"{SHOTS}/04_detail_visitor.png", full_page=True)
        await v.goto(BASE + "/")
        await v.screenshot(path=f"{SHOTS}/05_board.png", full_page=True)

        # 4. 지원 A
        ca = await new_ctx(b, ip="10.0.0.2"); pa = await ca.new_page()
        await apply(pa, pid, "지원자A")
        await expect(pa.get_by_text("방장이 확인하면").first).to_be_visible()
        await pa.screenshot(path=f"{SHOTS}/06_apply_done.png")
        await pa.goto(f"{BASE}/posts/{pid}")
        ok("지원자 A 대기 상태 표시", await pa.get_by_text("확인 중").count() >= 1)

        # 5. 지원 B: 같은 닉네임 거부 → 다른 닉네임
        cb = await new_ctx(b, ip="10.0.0.3"); pb = await cb.new_page()
        await apply(pb, pid, "지원자A")
        await expect(pb.get_by_text("이 글에서 이미 쓰고 있는 닉네임이에요").first).to_be_visible()
        ok("같은 글 닉네임 중복 거부", True)
        dlg = pb.locator("dialog[open]")
        await dlg.get_by_label("닉네임").fill("지원자B"); await dlg.get_by_label("방장에게 한마디").fill("저도 함께하고 싶어요. 열심히 할게요!"); await dlg.get_by_label("확인 비밀번호").fill("bb1234")
        await dlg.get_by_role("button", name="손 들기").click()
        await expect(pb.get_by_text("방장이 확인하면").first).to_be_visible()
        # 지원 C
        cc = await new_ctx(b, ip="10.0.0.4"); pc = await cc.new_page()
        await apply(pc, pid, "지원자C")
        await expect(pc.get_by_text("방장이 확인하면").first).to_be_visible()

        # 6. 방장: 새 소식 배지
        await a.goto(BASE + "/")
        badge = await a.get_by_label(re.compile("새 소식")).count()
        ok("방장 헤더에 새 소식 배지", badge >= 1)

        # 7. 지원자 관리: A 수락
        await a.goto(f"{BASE}/posts/{pid}/applicants")
        await a.screenshot(path=f"{SHOTS}/07_applicants.png", full_page=True)
        cardA = a.locator("li.card", has_text="지원자A")
        await cardA.get_by_role("button", name="함께하기", exact=True).click()
        await expect(cardA.get_by_text("함께해요")).to_be_visible()
        ok("수락 처리", True)
        # 되돌리기
        await cardA.get_by_role("button", name="되돌리기").click()
        await expect(cardA.get_by_text("확인 중")).to_be_visible()
        ok("수락 되돌리기", True)
        await cardA.get_by_role("button", name="함께하기", exact=True).click()
        await expect(cardA.get_by_text("함께해요")).to_be_visible()

        # 8. 동시 수락 경합: 남은 자리 1에 B·C를 동시에
        author2 = await new_ctx(b, ip="10.0.0.5"); a2 = await author2.new_page()
        await a2.goto(f"{BASE}/posts/{pid}/applicants")
        await a2.get_by_role("button", name="내 글 관리").click()
        await a2.fill("#v-secret-author", "pass1234")
        await a2.get_by_role("button", name="확인하기").click()
        await a2.wait_for_timeout(1500)
        await a2.goto(f"{BASE}/posts/{pid}/applicants")
        await a.goto(f"{BASE}/posts/{pid}/applicants")
        ok("다른 기기에서 관리 비밀번호로 방장 확인", await a2.locator("li.card", has_text="지원자B").count() == 1)
        await asyncio.gather(
            a.locator("li.card", has_text="지원자B").get_by_role("button", name="함께하기", exact=True).click(),
            a2.locator("li.card", has_text="지원자C").get_by_role("button", name="함께하기", exact=True).click(),
        )
        await asyncio.sleep(2)
        accepted = int(psql(f"select count(*) from applications where post_id='{pid}' and status='accepted'"))
        status = psql(f"select status from posts where id='{pid}'")
        ok("동시 수락에도 정원 초과 없음", accepted == 2, f"accepted={accepted}")
        ok("정원 차면 자동 마감", status == "closed", status)
        ns = psql(f"select count(*) from applications where post_id='{pid}' and status='not_selected'")
        ok("남은 대기 지원 미선정 처리", ns == "1", ns)

        # 9. 지원자 A: 연락방 보임
        await pa.goto(f"{BASE}/posts/{pid}")
        ok("수락된 지원자에게 연락방 링크", await pa.get_by_text(CONTACT).count() >= 1)
        await pa.screenshot(path=f"{SHOTS}/08_accepted_contact.png", full_page=True)
        await pa.goto(BASE + "/me?tab=apps")
        await pa.screenshot(path=f"{SHOTS}/09_me_apps.png", full_page=True)

        # 10. 다른 기기에서 지원 확인
        ca2 = await new_ctx(b, ip="10.0.0.6"); pa2 = await ca2.new_page()
        await pa2.goto(f"{BASE}/posts/{pid}")
        await pa2.get_by_role("button", name="내 지원 확인").click()
        await pa2.fill("#v-nick-applicant", "지원자A"); await pa2.fill("#v-secret-applicant", "ap1234")
        await pa2.get_by_role("button", name="확인하기").click()
        await pa2.wait_for_timeout(1500)
        await pa2.goto(f"{BASE}/posts/{pid}")
        ok("다른 기기에서 지원 확인 → 연락방 보임", await pa2.get_by_text(CONTACT).count() >= 1)

        # 11. 비밀번호 5회 실패 잠금
        cx = await new_ctx(b, ip="10.0.0.7"); px = await cx.new_page()
        await px.goto(f"{BASE}/posts/{pid}")
        await px.get_by_role("button", name="내 글 관리").click()
        for i in range(5):
            await px.fill("#v-secret-author", f"wrong{i}")
            await px.get_by_role("button", name="확인하기").click()
            await expect(px.get_by_text("비밀번호가 맞지 않아요")).to_be_visible()
        await px.fill("#v-secret-author", "pass1234")
        await px.get_by_role("button", name="확인하기").click()
        await expect(px.get_by_text(re.compile("여러 번 틀렸어요"))).to_be_visible()
        ok("5회 실패 후 맞는 비밀번호도 잠금", True)

        # 12. 참여 취소 → 재오픈
        await pa.goto(f"{BASE}/posts/{pid}")
        pa.once("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pa.get_by_role("button", name="참여 취소").click()
        await asyncio.sleep(1.5)
        ok("수락 후 취소 → 모집 재오픈", psql(f"select status from posts where id='{pid}'") == "recruiting")

        # 13. 마감일 경과 → 조회 시 자동 마감
        await a.goto(BASE + "/posts/new")
        await asyncio.sleep(61)  # 1분 작성 제한
        pid2 = await fill_post(a, "온라인 토익 스터디 모집합니다", capacity="4", mode="online")
        await apply(pb, pid2, "토익러")
        await expect(pb.get_by_text("방장이 확인하면").first).to_be_visible()
        psql(f"update posts set deadline = current_date - 1, start_date = current_date where id='{pid2}'")
        await v.goto(BASE + "/")
        st2 = psql(f"select status||'/'||closed_reason from posts where id='{pid2}'")
        ok("마감일 지나면 조회 시 자동 마감", st2 == "closed/deadline", st2)
        ok("마감 후 대기 지원 미선정", psql(f"select status from applications where post_id='{pid2}'") == "not_selected")
        await pb.goto(BASE + "/me?tab=apps")
        ok("지원자 내 활동에 새 소식", await pb.get_by_text("새 소식").count() >= 1)

        # 14. 필터
        await v.goto(BASE + "/?mode=offline&sido=%EC%84%9C%EC%9A%B8")
        ok("오프라인+서울 필터", await v.get_by_text("퇴근 후 SQL 기초 4주 완주").count() == 1 and await v.get_by_text("온라인 토익").count() == 0)
        await v.goto(BASE + "/?q=%ED%86%A0%EC%9D%B5&closed=1")
        ok("검색 + 마감 포함", await v.get_by_text("온라인 토익 스터디 모집합니다").count() == 1)

        # 15. 신고 3건 → 자동 숨김
        for i, ip in enumerate(["10.1.0.1", "10.1.0.2", "10.1.0.3"]):
            c = await new_ctx(b, ip=ip); pg = await c.new_page()
            await pg.goto(f"{BASE}/posts/{pid2}")
            await pg.get_by_role("button", name="신고", exact=True).click()
            await pg.locator("label", has_text="스팸·도배").click()
            await pg.get_by_role("button", name="신고하기").click()
            await expect(pg.get_by_text("신고했어요")).to_be_visible()
            await c.close()
        ok("신고 3건 자동 숨김", psql(f"select status from posts where id='{pid2}'") == "hidden")

        # 16. 운영자
        cad = await new_ctx(b, ip="10.0.0.8"); ad = await cad.new_page()
        await ad.goto(BASE + "/admin")
        await ad.fill("#pw", "admin1234"); await ad.get_by_role("button", name="들어가기").click()
        await expect(ad.get_by_role("heading", name="운영자")).to_be_visible()
        row = ad.locator("li", has_text="온라인 토익 스터디")
        await row.get_by_role("button", name="숨김 해제").click()
        await asyncio.sleep(1.5)
        ok("운영자 숨김 해제", psql(f"select status from posts where id='{pid2}'") == "closed")
        await ad.screenshot(path=f"{SHOTS}/10_admin.png", full_page=True)

        # 17. 다크 모드 스크린샷
        dk = await new_ctx(b, dark=True, ip="10.0.0.10"); d = await dk.new_page()
        await d.goto(BASE + "/"); await d.screenshot(path=f"{SHOTS}/11_board_dark.png", full_page=True)
        await d.goto(f"{BASE}/posts/{pid}"); await d.screenshot(path=f"{SHOTS}/12_detail_dark.png", full_page=True)
        # 데스크톱
        desk = await b.new_context(viewport={"width": 1280, "height": 900}); dp = await desk.new_page()
        await dp.goto(BASE + "/"); await dp.screenshot(path=f"{SHOTS}/13_board_desktop.png")
        await a.goto(f"{BASE}/posts/{pid}/edit"); await a.screenshot(path=f"{SHOTS}/14_edit.png", full_page=True)

        # 가로 스크롤 없음
        for path in ["/", f"/posts/{pid}", "/posts/new", "/me"]:
            await v.goto(BASE + path)
            sw = await v.evaluate("document.documentElement.scrollWidth")
            ok(f"가로 스크롤 없음 {path}", sw <= 390, f"scrollWidth={sw}")
        ok("브라우저 JS 오류 없음", not errs, "; ".join(errs[:3]))
        await b.close()

asyncio.run(main())
fails = [r for r in results if not r[1]]
print(f"\n{len(results)-len(fails)}/{len(results)} passed")
