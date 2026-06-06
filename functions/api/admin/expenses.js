// /api/admin/expenses  —  GET 목록 / POST 추가 (관리자 전용)
import { json, badRequest, requireAdmin } from "../_shared.js";

export async function onRequestGet({ request, env }) {
  const gate = requireAdmin(request, env);
  if (gate) return gate;
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM expenses ORDER BY spent_at DESC, id DESC LIMIT 500`
    ).all();
    return json({ ok: true, expenses: results || [] });
  } catch (e) {
    console.error("expense list failed:", e?.message || "db error");
    return json({ ok: false, error: "지출 조회 오류" }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const gate = requireAdmin(request, env);
  if (gate) return gate;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("잘못된 요청 형식입니다.");
  }

  const content = String(body.content || "").trim();
  const spent_at = String(body.spent_at || "").trim(); // YYYY-MM-DD
  const amount = parseInt(body.amount, 10);
  const note = String(body.note || "").trim();

  if (!content) return badRequest("내용을 입력해주세요.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spent_at)) return badRequest("날짜 형식(YYYY-MM-DD)을 확인해주세요.");
  if (!(amount >= 0)) return badRequest("비용을 확인해주세요.");

  try {
    const res = await env.DB.prepare(
      `INSERT INTO expenses (content, spent_at, amount, note) VALUES (?, ?, ?, ?)`
    ).bind(content, spent_at, amount, note).run();
    return json({ ok: true, id: res.meta?.last_row_id });
  } catch (e) {
    console.error("expense insert failed:", e?.message || "db error");
    return json({ ok: false, error: "지출 저장 오류" }, 500);
  }
}
