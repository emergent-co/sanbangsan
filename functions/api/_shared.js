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

// --- Cloudflare Access JWT 확인 (관리자 API 보호) ---
// Access가 앞단에서 인증을 강제하지만, Worker단에서도 헤더 존재 + (선택)이메일 일치를 재확인한다.
// 헤더: Cf-Access-Jwt-Assertion / Cf-Access-Authenticated-User-Email
export function getAccessIdentity(request) {
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  return { jwt, email };
}

// 관리자 API 게이트: Access JWT가 없으면 차단.
// ADMIN_EMAIL 환경변수가 설정돼 있으면 이메일 일치까지 확인(이중 안전장치).
export function requireAdmin(request, env) {
  const { jwt, email } = getAccessIdentity(request);
  if (!jwt) return unauthorized("Cloudflare Access 인증이 필요합니다.");
  if (env.ADMIN_EMAIL && email && email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
    return unauthorized("허용되지 않은 계정입니다.");
  }
  return null; // 통과
}
