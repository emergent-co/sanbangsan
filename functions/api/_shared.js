// 공용 유틸 — Cloudflare Pages Functions
// PII(연락처·주소)는 절대 console에 출력하지 않는다.

export const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function badRequest(msg) {
  return json({ ok: false, error: msg }, 400);
}

export function unauthorized(msg = "unauthorized") {
  return json({ ok: false, error: msg }, 401);
}

// --- Cloudflare Turnstile 서버 검증 (공개 주문 폼 봇 방지) ---
export async function verifyTurnstile(token, secret, ip) {
  if (!secret) return { success: false, reason: "no-secret" };
  if (!token) return { success: false, reason: "no-token" };
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const out = await r.json();
  return { success: !!out.success, reason: (out["error-codes"] || []).join(",") };
}

// --- 관리자 비밀번호 게이트 ---
// 관리자 페이지(admin.html)가 X-Admin-Key 헤더로 비밀번호를 보내면, 서버 환경변수
// ADMIN_KEY(Cloudflare Secret)와 일치할 때만 통과시킨다. (Cloudflare Access 불필요)
// 비밀번호는 코드에 저장하지 않고 전부 Cloudflare Secret으로만 보관한다.
export function requireAdmin(request, env) {
  const key = request.headers.get("X-Admin-Key") || "";
  if (!env.ADMIN_KEY || key.length === 0 || key !== env.ADMIN_KEY) {
    return unauthorized("관리자 비밀번호가 필요합니다.");
  }
  return null; // 통과
}
