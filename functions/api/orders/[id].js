// /api/orders/:id  —  PATCH 상태변경 (관리자 전용, Access 보호)
import { json, badRequest, requireAdmin } from "../_shared.js";

const ALLOWED_STATUS = ["신규", "입금확인", "발송완료"];

export async function onRequestPatch({ request, env, params }) {
  const gate = requireAdmin(request, env);
  if (gate) return gate;

  const id = parseInt(params.id, 10);
  if (!(id > 0)) return badRequest("잘못된 주문번호입니다.");

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("잘못된 요청 형식입니다.");
  }

  const status = String(body.status || "");
  if (!ALLOWED_STATUS.includes(status)) return badRequest("허용되지 않은 상태값입니다.");

  try {
    const res = await env.DB.prepare(`UPDATE orders SET status = ? WHERE id = ?`)
      .bind(status, id)
      .run();
    if (!res.meta || res.meta.changes === 0) {
      return json({ ok: false, error: "해당 주문을 찾을 수 없습니다." }, 404);
    }
    return json({ ok: true, id, status });
  } catch (e) {
    console.error("order update failed:", e?.message || "db error");
    return json({ ok: false, error: "상태 변경 오류" }, 500);
  }
}
