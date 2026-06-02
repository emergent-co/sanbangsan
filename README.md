# 산방산 농수산 주문접수 시스템 (shop.cellab.kr)

제주 고당도 귤(카라향) 주문접수 + 관리자 + 선택주문 문자전송 시스템.
**Cloudflare Pages + Pages Functions(Workers) + D1 + Access + Turnstile** 구성. 별도 서버 없음.

---

## 1. 파일 구조

```
sanbangsan/
├── index.html              # 고객 주문 페이지 (장바구니·분리동의·결제안내·공유·Turnstile)
├── admin.html              # 관리자 페이지 (/admin → Access 보호). 목록·상태변경·SMS·마케팅추출
├── privacy.html            # 개인정보 처리방침
├── functions/api/
│   ├── _shared.js          # 공용: JSON 응답 / Turnstile 검증 / Access JWT 게이트
│   ├── orders.js           # POST(공개+Turnstile) / GET(관리자)
│   └── orders/[id].js      # PATCH 상태변경(관리자)
├── schema.sql              # D1 orders 테이블 + 인덱스
├── _routes.json            # /api/* 만 Functions 실행
├── wrangler.toml           # D1 바인딩(DB)
└── README.md
```

데이터 흐름: 브라우저는 **D1에 직접 접근하지 않음**. 모든 DB 작업은 `/api/*` Worker를 통해서만 이루어집니다.

---

## 2. 배포 전 채워야 할 값 (코드 내 placeholder)

비밀키가 아닌 공개 가능한 값만 코드에 둡니다. 비밀값은 전부 Cloudflare Secret으로 저장합니다.

| 위치 | 키 | 설명 |
|---|---|---|
| `index.html` CONFIG | `TURNSTILE_SITEKEY` | Turnstile 사이트키(공개키) |
| `index.html` CONFIG | `KAKAO_JS_KEY` | 카카오 공유용 JavaScript 키 |
| `index.html` CONFIG | `KAKAO_CHANNEL_URL` / `NAVER_TALK_URL` | 채널 개설 후 입력(비우면 "준비중") |
| `wrangler.toml` | `database_id` | `wrangler d1 create` 출력값 |
| Cloudflare Secret | `TURNSTILE_SECRET` | Turnstile 시크릿(서버 검증용) |
| Cloudflare Secret | `ADMIN_EMAIL` | `emgt.yhlee@gmail.com` (관리자 API 이중확인) |
| Cloudflare Secret | `SOLAPI_API_KEY` 등 | (2단계 자동문자 도입 시) |

> 인스타그램 `https://instagram.com/father.job`, 사장님 문자번호 `010-6553-5371`(admin.html CONFIG), 입금계좌 `하나은행 115-910946-09507 이영현` 은 이미 반영됨.

---

## 3. Cloudflare 설정 (대시보드 클릭 가이드)

### 3-1. D1 데이터베이스 생성 + 스키마 적용
로컬에서 Wrangler CLI 사용(설치: `npm i -g wrangler`, `wrangler login`):
```bash
wrangler d1 create sanbangsan-db
#   → 출력된 database_id 를 wrangler.toml 의 database_id 에 붙여넣기
wrangler d1 execute sanbangsan-db --remote --file=./schema.sql
```

### 3-2. Pages 프로젝트 생성 + GitHub 연결
1. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git**
2. 저장소 `emergent-co/sanbangsan` 선택 → 프로덕션 브랜치 `main`
3. 빌드 설정: **Framework preset = None**, Build command 비움, **Output directory = `/`**
4. Save and Deploy. 이후 `git push` 마다 자동 배포.

### 3-3. D1 바인딩 (Pages 프로젝트에 연결)
**Pages 프로젝트 → Settings → Functions → D1 database bindings → Add**
- Variable name: **`DB`**  / D1 database: **`sanbangsan-db`**
- (Production / Preview 양쪽 모두 추가 권장)

### 3-4. 환경변수 / Secret 등록
**Pages 프로젝트 → Settings → Environment variables → Add (Encrypt 체크 = Secret)**
- `TURNSTILE_SECRET` = Turnstile 시크릿
- `ADMIN_EMAIL` = `emgt.yhlee@gmail.com`

### 3-5. Turnstile 발급
1. 대시보드 → **Turnstile → Add site** → 도메인 `shop.cellab.kr` 입력
2. 발급된 **Site Key** → `index.html` CONFIG.TURNSTILE_SITEKEY
3. **Secret Key** → 위 3-4의 `TURNSTILE_SECRET` Secret

### 3-6. Cloudflare Access (관리자 /admin 보호)
**Zero Trust → Access → Applications → Add an application → Self-hosted**
- Application name: `sanbangsan-admin`
- Application domain: `shop.cellab.kr`, Path: **`admin.html`** (또는 `/admin*`)
- Policy: Action **Allow**, Include → **Emails** → `emgt.yhlee@gmail.com`
- 로그인 방식: One-time PIN(이메일 OTP) 또는 Google
- 저장 후 `/admin.html` 접근 시 로그인 화면이 뜨면 정상. 인증 통과 요청에만
  `Cf-Access-Jwt-Assertion` 헤더가 붙어 관리자 API가 응답합니다.

> Access가 앞단에서 막고, Worker(`requireAdmin`)가 JWT 헤더 + ADMIN_EMAIL 일치를 재확인하는 **이중 방어** 구조입니다.

---

## 4. 도메인 연결 (shop.cellab.kr)

### A. cellab.kr DNS가 이미 Cloudflare에 있는 경우 (권장)
**Pages 프로젝트 → Custom domains → Set up a custom domain → `shop.cellab.kr`**
→ Cloudflare가 자동으로 CNAME 레코드를 생성합니다. 끝.

### B. DNS가 외부(가비아/후이즈 등)에 있는 경우
도메인 등록업체 DNS 관리에서 아래 레코드 추가:
```
유형:  CNAME
이름:  shop
값:    <pages-프로젝트>.pages.dev
```
(정확한 대상값은 Pages → Custom domains 화면에 표시됨)
또는 cellab.kr 전체를 Cloudflare로 네임서버 이전하면 A안처럼 간단해집니다.

### HTTPS
Pages는 기본 HTTPS 자동 적용. SSL/TLS → Edge Certificates에서 **Always Use HTTPS = On** 확인.

---

## 5. 데이터 모델 (D1 `orders`)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | INTEGER PK | 주문번호(자동, 배송지별 1행) |
| batch_id | TEXT | 같은 주문(다중 배송지) 묶음 식별자 |
| created_at | TEXT | 주문시각(UTC ISO) |
| status | TEXT | 신규 / 입금확인 / 발송완료 |
| items_json | TEXT | `[{group,name,weight,qty,unit}]` |
| total_amount | INTEGER | 합계(서버 재계산값) |
| name, phone, zipcode, address, address_detail | TEXT | 배송정보 |
| request | TEXT | 요청사항(선택) |
| depositor_name | TEXT | 입금자명 |
| agree_privacy | INTEGER | 필수동의(1만 저장) |
| agree_marketing | INTEGER | 광고동의(0/1) |
| agreed_at | TEXT | 동의시각 |

인덱스: `idx_orders_created_at`, `idx_orders_status` (목록 정렬·필터 최적화, 전체스캔 방지).

---

## 6. 보안 / 개인정보 가드레일 (구현 반영)

- DB 접근은 전부 Worker API 경유. 관리자 API(GET/PATCH)는 **Access JWT 통과 시에만** 응답.
- 공개 API(POST)는 **Turnstile 서버검증 필수** + **합계·가격 서버 재계산**(클라 금액 불신).
- `agree_privacy`는 서버에서도 재확인 후에만 저장. 필수/선택 동의 **분리 저장**.
- 광고 동의 기본 **해제**, 미동의해도 주문 가능(끼워넣기 동의 금지).
- console/로그에 **PII(연락처·주소) 미출력** — 주문번호·합계만 기록.
- 비밀키/비밀번호는 저장소·클라이언트에 **평문 커밋 금지**(전부 Cloudflare Secret).
- 개인정보를 URL 쿼리스트링에 노출하지 않음(전송은 POST 본문).
- 푸터에 개인정보 처리방침(`privacy.html`) 링크.

---

## 7. 문자 발송

**1단계 (현재 구현)**: admin에서 선택 주문을 합성해 `sms:` URI로 사장님 폰(`010-6553-5371`)
기본 문자앱에 자동입력. 서버·비용 불필요. 데스크톱 등 미동작 환경은 "문자내용 복사"로 대체.

**2단계 (선택, TODO)**: `/functions/api/notify.js` Worker에서 솔라피(Solapi) API 호출로 자동발송.
API 키는 `SOLAPI_API_KEY` Secret으로만 보관. admin.html `smsSelected()` 내 TODO 주석 참고.

---

## 8. 문의 AI 자동응답 — 향후 설계안 (이번엔 "준비중" 버튼만)

- **메인 채널 = 카카오톡 채널**. 카카오 i 오픈빌더의 **스킬 서버**에 LLM(API)을 연동.
- 스킬 서버는 **Cloudflare Worker**로 구현 → 한 벤더로 통일. D1의 `orders`를 조회해
  "내 주문/배송 상태" 질문에 실제 데이터로 응답(이름+연락처/주문번호로 본인확인).
- FAQ(상품 차이, 배송기간, 입금계좌, 환불) 자동응답 + 미해결 시 상담사 연결.
- 대안: **채널톡**(빠른 도입) 또는 사이트 내 자체 웹챗 위젯(키는 Worker에 보관).

---

## 9. 로컬 개발

```bash
npm i -g wrangler
wrangler d1 execute sanbangsan-db --local --file=./schema.sql   # 로컬 D1 초기화
wrangler pages dev .                                            # http://localhost:8788
```
로컬에서는 Access 헤더가 없으므로 관리자 API가 401이 정상입니다. 테스트 시
`_shared.js`의 게이트를 임시 우회하거나 `wrangler pages dev` + 헤더 주입을 사용하세요(커밋 금지).
