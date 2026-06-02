-- 산방산 농수산 주문 시스템 — Cloudflare D1 스키마
-- 적용:  wrangler d1 execute sanbangsan-db --file=./schema.sql  (로컬은 --local 추가)

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id        TEXT,                                -- 같은 주문(다중 배송지) 묶음 식별자. 단일 배송지도 부여
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  status          TEXT    NOT NULL DEFAULT '신규',     -- 신규 / 입금확인 / 발송완료
  items_json      TEXT    NOT NULL,                    -- [{group,weight,qty,unit}] JSON 문자열
  total_amount    INTEGER NOT NULL,                    -- 합계(원), 택배비 0
  name            TEXT    NOT NULL,                    -- 받는분 성함
  phone           TEXT    NOT NULL,                    -- 연락처
  zipcode         TEXT,                                -- 우편번호
  address         TEXT    NOT NULL,                    -- 기본주소
  address_detail  TEXT,                                -- 상세주소
  request         TEXT,                                -- 배송 요청사항(선택)
  depositor_name  TEXT    NOT NULL,                    -- 입금자명
  agree_privacy   INTEGER NOT NULL DEFAULT 0,          -- 필수 동의 (1만 저장 허용)
  agree_marketing INTEGER NOT NULL DEFAULT 0,          -- 광고성 정보 수신(선택)
  agreed_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 과다 전체스캔 방지용 인덱스 (목록은 status 필터 + 최신순 정렬)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_batch      ON orders (batch_id);

-- 기존 DB에 batch_id가 없을 경우(이미 운영 중이면) 아래로 추가:
--   ALTER TABLE orders ADD COLUMN batch_id TEXT;
--   CREATE INDEX IF NOT EXISTS idx_orders_batch ON orders (batch_id);
