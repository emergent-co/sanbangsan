// /api/admin/orders  —  GET 주문 목록 (관리자 전용, Cloudflare Access로 /api/admin 보호)
import { json, requireAdmin } from "../_shared.js";

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
