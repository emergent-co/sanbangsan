-- #1~7 주문일을 2026-06-02 로 변경 (정렬 유지 위해 1분 간격)
-- 실행: npx wrangler d1 execute sanbangsan-db --remote --file=./set_dates.sql
UPDATE orders SET created_at='2026-06-02T00:01:00Z' WHERE id=1;
UPDATE orders SET created_at='2026-06-02T00:02:00Z' WHERE id=2;
UPDATE orders SET created_at='2026-06-02T00:03:00Z' WHERE id=3;
UPDATE orders SET created_at='2026-06-02T00:04:00Z' WHERE id=4;
UPDATE orders SET created_at='2026-06-02T00:05:00Z' WHERE id=5;
UPDATE orders SET created_at='2026-06-02T00:06:00Z' WHERE id=6;
UPDATE orders SET created_at='2026-06-02T00:07:00Z' WHERE id=7;
