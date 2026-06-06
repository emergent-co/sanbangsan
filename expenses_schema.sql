-- 지출내역 테이블 (한 번만 실행)
-- 실행: npx wrangler d1 execute sanbangsan-db --remote --file=./expenses_schema.sql
CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  content     TEXT    NOT NULL,                 -- 내용
  spent_at    TEXT    NOT NULL,                 -- 날짜 (YYYY-MM-DD)
  amount      INTEGER NOT NULL DEFAULT 0,       -- 비용(원)
  note        TEXT,                             -- 비고
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_spent_at ON expenses (spent_at DESC);
