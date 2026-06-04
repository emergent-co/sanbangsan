-- 주문번호 전체 연속 재정렬(날짜순 1..N, 빈 번호 없음)
--  + 이영현(샘플) 추가 + 심명효 수량 2→1
-- ※ 이 파일을 실행하세요. (이전 renumber_orders.sql 은 실행하지 마세요)
-- 실행: npx wrangler d1 execute sanbangsan-db --remote --file=./resequence_orders.sql
-- ※ 한 번만 실행. 두 번 실행하면 이영현이 중복됩니다.

-- 1) 기존 모든 주문 id를 큰 값으로 이동(충돌 방지)
UPDATE orders SET id = id + 100000;

-- 2) 이영현(샘플) 추가 — 가장 이른 날짜(맨 아래/가장 오래된 주문)
INSERT INTO orders
  (id, batch_id, created_at, status, items_json, total_amount, name, phone, zipcode, address, address_detail, request, depositor_name, agree_privacy, agree_marketing)
VALUES
  (1, 'hist-0', '2026-05-26T00:00:00Z', '발송완료',
   '[{"group":"B","name":"못난이 카라향","weight":"3kg","qty":1,"unit":25000}]', 25000,
   '이영현(샘플용)', '010-6553-5371', '', '부산광역시 금정구 부산대학로63번길 2', '통합기계관 212호', '', '이영현', 1, 0);

-- 3) 심명효 수량 2→1, 합계 50000→25000
UPDATE orders
   SET items_json='[{"group":"B","name":"못난이 카라향","weight":"3kg","qty":1,"unit":25000}]',
       total_amount=25000
 WHERE name='심명효';

-- 4) 날짜 오름차순으로 1..N 연속 부여
WITH ranked AS (
  SELECT id AS oldid, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM orders
)
UPDATE orders SET id = (SELECT rn FROM ranked WHERE ranked.oldid = orders.id);

-- 5) 자동증가 시퀀스를 현재 최대 id로 맞춰 다음 주문이 이어지게
UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM orders) WHERE name='orders';
