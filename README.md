# 스터디보드 — 가입 없는 스터디 모집 보드

캠프·커뮤니티 구성원이 **가입 없이 링크 하나로** 스터디를 모집하고 지원하는 웹 서비스입니다.
기획 문서: `07_PRD 만들어보기/16_스터디_매칭보드/스터디매칭보드_PRD_v0.3.md`

- 방장: 모집글 작성(닉네임 + 관리 비밀번호) → 지원자 수락·거절 → 정원이 차면 자동 마감
- 지원자: 닉네임 + 지원 메시지 + 확인 비밀번호로 지원 → 수락되면 연락방 링크가 보임
- 같은 브라우저는 자동으로 기억(httpOnly 쿠키), 다른 기기는 비밀번호로 확인
- 운영자: `/admin` (숨김·비밀번호 초기화·신고 처리·파일럿 후 전체 삭제)

## 기술 스택
Next.js 16 (App Router, Server Actions) · PostgreSQL(Supabase 권장) · Tailwind CSS 4 · Pretendard · Vercel 배포

디자인: `ui-ux-pro-max` 스킬의 디자인 시스템(Minimalism & Swiss, 대비 4.5:1, 오류 요약 포커스 등) + `emil-design-eng` 원칙(눌림 scale 0.97, 강한 ease-out, 300ms 이하, reduced-motion) + 토스풍 원칙(큰 제목, 한 화면 한 행동). **토스 TDS 컴포넌트는 앱인토스 전용 라이선스라 사용하지 않았고 모든 UI는 자체 구현**입니다.

---

## 배포하기 (약 20분, 무료)

### 1) Supabase에서 DB 만들기
1. https://supabase.com 가입 → **New project**
2. Region은 **Northeast Asia (Seoul)**, DB 비밀번호는 따로 적어 두기
3. 왼쪽 **SQL Editor** → New query → 이 폴더의 `db/schema.sql` 내용을 전부 붙여 넣고 **Run**
4. 상단 **Connect** 버튼 → **Transaction pooler** 주소를 복사 (포트 `6543`). `[YOUR-PASSWORD]` 자리에 3번에서 적은 비밀번호를 넣으면 `DATABASE_URL` 완성

### 2) GitHub에 코드 올리기
1. https://github.com/new 에서 새 저장소(Private 권장) 생성
2. 이 폴더에서:
   ```bash
   git init && git add . && git commit -m "스터디보드 첫 배포"
   git branch -M main
   git remote add origin https://github.com/<내아이디>/<저장소이름>.git
   git push -u origin main
   ```
   `.env.local`은 `.gitignore`에 있어 올라가지 않아요.

### 3) Vercel에 배포
1. https://vercel.com 에서 GitHub로 로그인 → **Add New → Project** → 방금 저장소 **Import**
2. **Environment Variables**에 아래 5개 입력 (`.env.example` 참고)

   | 이름 | 값 |
   | --- | --- |
   | `DATABASE_URL` | 1-4에서 만든 주소 |
   | `SESSION_SECRET` | 아무 긴 무작위 문자열 (예: 터미널에서 `openssl rand -base64 32`) |
   | `ADMIN_PASSWORD` | `/admin` 비밀번호 |
   | `CRON_SECRET` | 아무 무작위 문자열 |
   | `PILOT_DELETE_DATE` | 데이터 삭제 예정일 `YYYY-MM-DD` (비우면 배너 없음) |
3. **Deploy** → 1~2분 뒤 `https://<프로젝트>.vercel.app` 주소가 생겨요
4. 마감 배치: `vercel.json`에 매일 00:05(KST) 실행이 들어 있어요. 조회할 때도 마감 처리를 하므로 배치가 멈춰도 동작해요.

### 4) 런칭 체크리스트 (PRD §23)
- [ ] 휴대폰으로 글 쓰기 → 다른 브라우저(시크릿 창)로 지원 → 수락 → 연락방 링크 보이는지 확인
- [ ] `/admin` 들어가기, 비밀번호 초기화 리허설
- [ ] 실제 모집글 5개 이상 미리 올리기 (빈 보드 방지)
- [ ] 커뮤니티 공지에 보드 링크 공유
- [ ] 파일럿 종료 후 `/admin` → 전체 데이터 삭제

> Supabase 무료 프로젝트는 오래 사용이 없으면 일시 정지될 수 있어요. 대시보드에서 다시 켜면 됩니다.

---

## 로컬에서 실행
```bash
cp .env.example .env.local   # DATABASE_URL 등 채우기
npm install
npm run db:migrate           # 스키마 적용
npm run dev                  # http://localhost:3000
```

## 테스트
`tests/e2e.py` — Playwright(Python) 시나리오 34개: 오류 요약·포커스, 작성·지원·수락·되돌리기, **동시 수락 시 정원 초과 없음**, 자동 마감·미선정, 다른 기기 비밀번호 확인, 5회 실패 잠금, 참여 취소 시 재오픈, 신고 3건 자동 숨김, 운영자, 방문자 응답에 연락 링크·해시 없음, 360~390px 가로 스크롤 없음.
```bash
npm run build && npm start &
pip install playwright && python -m playwright install chromium
python tests/e2e.py   # 로컬 DB를 사용. 실행 전 테이블을 비워 두세요
```

## PRD와 다르게 구현한 부분
| PRD | 구현 | 이유 |
| --- | --- | --- |
| 브라우저 저장소에 토큰 보관 | httpOnly 기기 쿠키 + 서버의 권한 표(grants) | 스크립트로 토큰을 읽을 수 없어 더 안전, 서버 렌더링에서 바로 권한 판단 |
| 시·군·구 선택 목록 | 시·도 선택 + 시·군·구 입력(형식 검사) | 전국 목록 관리 부담 없이 필터 가능 |
| 무한 스크롤 | "더 보기" 버튼 | 접근성·뒤로가기 위치 유지 |
| 수락 5초 실행 취소 | 30초 안 "수락 되돌리기" | 알림을 지연 발송할 필요 없이 새 소식을 지우는 방식 |
| 5분 주기 마감 배치 | 조회 시점 마감 + 하루 1회 배치 | Vercel 무료 요금제 cron 제한 |

## 폴더 구조
```
db/schema.sql           DB 스키마 (Supabase SQL Editor에 그대로 실행)
src/lib/actions.ts      모든 쓰기 동작 (Server Actions, 권한·요청 제한·트랜잭션)
src/lib/data.ts         조회·자동 마감·새 소식
src/lib/security.ts     비밀번호 해시(scrypt)·기기 쿠키·운영자 세션
src/lib/validation.ts   폼 검증 (PRD FR-003, BR-012)
src/app/                화면 (보드, 상세, 작성·수정, 지원자 관리, 내 활동, 운영자)
src/components/         바텀시트·토스트·폼 등 UI
tests/e2e.py            E2E 테스트
```
