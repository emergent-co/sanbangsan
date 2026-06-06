// /api/admin/expenses/:id  —  DELETE 지출 삭제 (관리자 전용)
import { json, badRequest, requireAdmin } from "../../_shared.js";

export async function onRequestDelete({ request, env, params }) {
  const gate = requireAdmin(request, env);
  if (gate) return gate;

  const id = parseInt(params.id, 10);
  if (!(id > 0)) return badRequest("잘못된 지출번호입니다.");

  try {
    const res = await env.DB.prepare(`DELETE FROM expenses WHERE id = ?`)
      .bind(id)
      .run();
    if (!res.meta || res.meta.changes === 0) {
      return json({ ok: false, error: "해당 지출을 찾을 수 없습니다." }, 404);
    }
    return json({ ok: true, id });
  } catch (e) {
    console.error("expense delete failed:", e?.message || "db error");
    return json({ ok: false, error: "삭제 오류" }, 500);
  }
}
