-- 주문번호 전체 연속 정렬 + 이영현(샘플) 추가 + 심명효 수량 2→1
-- 최종: #1 이영현(샘플) #2 심명효 #3 김나영 #4 장경숙 #5 전정례 #6 이미영 #7 김나은 #8 기존#11
-- 실행: Cloudflare D1 Console 붙여넣기  또는
--   npx wrangler d1 execute sanbangsan-db --remote --file=./renumber_orders.sql
-- ※ 이 파일은 한 번만 실행하세요(중복 실행 금지).

-- 1) 기존 고객 6건을 한 칸씩 뒤로(충돌 방지 위해 큰 번호부터)
UPDATE orders SET id=7 WHERE id=6;   -- 김나은
UPDATE orders SET id=6 WHERE id=5;   -- 이미영
UPDATE orders SET id=5 WHERE id=4;   -- 전정례
UPDATE orders SET id=4 WHERE id=3;   -- 장경숙
UPDATE orders SET id=3 WHERE id=2;   -- 김나영
UPDATE orders SET id=2 WHERE id=1;   -- 심명효

-- 2) 실제 주문(기존 #11 이상)을 -3 당겨 연속으로 (#11→#8)
UPDATE orders SET id=id-3 WHERE id>=11;

-- 3) 심명효(현재 #2) 수량 2→1, 합계 50000→25000
UPDATE orders
   SET items_json='[{"group":"B","name":"못난이 카라향","weight":"3kg","qty":1,"unit":25000}]',
       total_amount=25000
 WHERE id=2;

-- 4) 맨 앞 #1 이영현(샘플) 추가 — 가장 이른 날짜로 맨 아래(가장 오래된 주문) 표시
INSERT INTO orders
  (id, batch_id, created_at, status, items_json, total_amount, name, phone, zipcode, address, address_detail, request, depositor_name, agree_privacy, agree_marketing)
VALUES
  (1, 'hist-0', '2026-05-26T00:00:00Z', '발송완료',
   '[{"group":"B","name":"못난이 카라향","weight":"3kg","qty":1,"unit":25000}]', 25000,
   '이영현(샘플용)', '010-6553-5371', '', '부산광역시 금정구 부산대학로63번길 2', '통합기계관 212호', '', '이영현', 1, 0);
