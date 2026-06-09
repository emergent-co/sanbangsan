// /api/orders  —  POST(공개, Turnstile 검증) / GET(관리자, Access 보호)
import { json, badRequest, requireAdmin, verifyTurnstile } from "./_shared.js";

// 서버측 가격표(원). 클라이언트가 보낸 금액을 믿지 않고 여기서 재계산한다.
const PRICES = {
  A: { name: "카라향 정품 소과", opts: { "3kg": 35000, "5kg": 49000 } },
  B: { name: "못난이 카라향",     opts: { "3kg": 25000, "5kg": 38000, "10kg": 58000 } },
  C: { name: "제주 애플망고 3kg", opts: { "5~6개입": 145000, "7~8개입": 130000, "9~11개입": 120000, "12~14개입": 110000 } },
  D: { name: "미니 애플망고 3kg", opts: { "3kg": 90000 } },
};

// --- POST /api/orders : 주문 생성(공개) ---
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("잘못된 요청 형식입니다.");
  }

  // 1) Turnstile 봇 검증 (클라이언트 검증만 믿지 않음)
  const ip = request.headers.get("CF-Connecting-IP");
  const ts = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET, ip);
  if (!ts.success) return badRequest("봇 방지 인증에 실패했습니다. 다시 시도해주세요.");

  // 2) 필수 동의 서버 재검증
  if (body.agree_privacy !== true && body.agree_privacy !== 1) {
    return badRequest("개인정보 수집·이용 동의가 필요합니다.");
  }

  // 공통 정보 (주문 전체에 1개)
  const depositor = (body.depositor_name || "").trim();
  if (!depositor) return badRequest("입금자명을 입력해주세요.");
  const agreeMkt = body.agree_marketing === true || body.agree_marketing === 1 ? 1 : 0;

  // 3) 배송지 목록 정규화 (단일 배송지도 shipments 1건으로 처리)
  let shipments = Array.isArray(body.shipments) ? body.shipments : null;
  if (!shipments) {
    // 하위호환: 예전 단일 배송지 payload(name/phone/address/items) 지원
    shipments = [{
      name: body.name, phone: body.phone, zipcode: body.zipcode,
      address: body.address, address_detail: body.address_detail,
      request: body.request, items: body.items,
    }];
  }
  if (shipments.length === 0) return badRequest("배송지가 없습니다.");
  if (shipments.length > 50) return badRequest("배송지가 너무 많습니다.");

  // 각 배송지 검증 + 합계 서버 재계산
  const rows = [];
  let grandTotal = 0;
  for (const sh of shipments) {
    const items = Array.isArray(sh.items) ? sh.items : [];
    if (items.length === 0) return badRequest("각 배송지에 상품을 1개 이상 담아주세요.");
    let total = 0;
    const clean = [];
    for (const it of items) {
      const g = String(it.group || "").toUpperCase();
      const w = String(it.weight || "");
      const qty = parseInt(it.qty, 10);
      const prod = PRICES[g];
      if (!prod || !prod.opts[w] || !(qty > 0) || qty > 999) {
        return badRequest("주문 품목 정보가 올바르지 않습니다.");
      }
      const unit = prod.opts[w];
      total += unit * qty;
      clean.push({ group: g, name: prod.name, weight: w, qty, unit });
    }
    const name = (sh.name || "").trim();
    const phone = (sh.phone || "").trim();
    const address = (sh.address || "").trim();
    if (!name || !phone || !address) {
      return badRequest("받는분·연락처·주소를 모두 입력해주세요.");
    }
    if (!/^[0-9\-+\s]{8,20}$/.test(phone)) return badRequest("연락처 형식을 확인해주세요.");
    grandTotal += total;
    rows.push({
      items: JSON.stringify(clean), total, name, phone,
      zipcode: (sh.zipcode || "").trim(), address,
      address_detail: (sh.address_detail || "").trim(),
      request: (sh.request || "").trim(),
    });
  }

  // 4) D1 배치 저장 — 같은 주문은 동일 batch_id 로 묶음 (배송지별 1행)
  const batchId = crypto.randomUUID();
  const insert = env.DB.prepare(
    `INSERT INTO orders
       (batch_id, status, items_json, total_amount, name, phone, zipcode, address,
        address_detail, request, depositor_name, agree_privacy, agree_marketing)
     VALUES (?, '신규', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  const stmts = rows.map((r) =>
    insert.bind(batchId, r.items, r.total, r.name, r.phone, r.zipcode,
      r.address, r.address_detail, r.request, depositor, agreeMkt)
  );

  try {
    await env.DB.batch(stmts);
    // PII는 로그에 남기지 않는다. (배송지 수/합계만)
    return json({ ok: true, batch_id: batchId, count: rows.length, total: grandTotal });
  } catch (e) {
    console.error("order insert failed:", e?.message || "db error"); // PII 미포함
    return json({ ok: false, error: "주문 저장 중 오류가 발생했습니다." }, 500);
  }
}

// --- GET /api/orders : 주문 목록(관리자 전용) ---
export async function onRequestGet({ request, env }) {
  const gate = requireAdmin(request, env);
  if (gate) return gate;

  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // 신규 / 입금확인 / 발송완료 / (없으면 전체)
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 500);

  let query, binds;
  if (status && ["신규", "입금확인", "발송완료"].includes(status)) {
    query = `SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ?`;
    binds = [status, limit];
  } else {
    query = `SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`;
    binds = [limit];
  }

  try {
    const { results } = await env.DB.prepare(query).bind(...binds).all();
    return json({ ok: true, orders: results || [] });
  } catch (e) {
    console.error("order list failed:", e?.message || "db error");
    return json({ ok: false, error: "목록 조회 오류" }, 500);
  }
}
