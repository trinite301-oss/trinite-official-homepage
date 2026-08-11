/* =========================================================
   TRINITE — 문의 목록 조회 함수 (Netlify Function)
   ---------------------------------------------------------
   Netlify Forms에 쌓인 문의를 안전하게 불러옵니다.
   접근 토큰은 서버(환경변수)에만 있고 브라우저에 노출되지 않습니다.

   필요한 환경변수 (Netlify → Site settings → Environment variables):
     - NETLIFY_API_TOKEN : Netlify 개인용 액세스 토큰
     - NETLIFY_SITE_ID   : 사이트 ID (Site settings → General → Site ID)
     - INQUIRY_PASSCODE  : 문의함 페이지 비밀번호
   ========================================================= */
exports.handler = async (event) => {
  const json = (code, obj) => ({
    statusCode: code,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(obj),
  });

  // 1) 비밀번호 확인
  const pass =
    (event.headers && (event.headers["x-inquiry-pass"] || event.headers["X-Inquiry-Pass"])) ||
    (event.queryStringParameters && event.queryStringParameters.pw) ||
    "";
  const expected = process.env.INQUIRY_PASSCODE || "";
  if (!expected) return json(500, { error: "서버에 INQUIRY_PASSCODE가 설정되지 않았습니다." });
  if (pass !== expected) return json(401, { error: "비밀번호가 올바르지 않습니다." });

  // 2) 토큰/사이트 ID 확인
  const token = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!token || !siteId)
    return json(500, { error: "NETLIFY_API_TOKEN 또는 NETLIFY_SITE_ID 환경변수가 없습니다." });

  const api = "https://api.netlify.com/api/v1";
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  try {
    // 3) 'contact' 폼 찾기
    const formsRes = await fetch(`${api}/sites/${siteId}/forms`, auth);
    if (!formsRes.ok) throw new Error(`폼 목록 조회 실패 (${formsRes.status})`);
    const forms = await formsRes.json();
    const form = forms.find((f) => f.name === "contact") || forms[0];
    if (!form) return json(200, { submissions: [] });

    // 4) 제출 내역 조회
    const subsRes = await fetch(`${api}/forms/${form.id}/submissions?per_page=100`, auth);
    if (!subsRes.ok) throw new Error(`문의 조회 실패 (${subsRes.status})`);
    const subs = await subsRes.json();

    const submissions = subs.map((s) => ({
      id: s.id,
      created_at: s.created_at,
      data: s.data || {},
    }));
    return json(200, { count: submissions.length, submissions });
  } catch (err) {
    return json(502, { error: String((err && err.message) || err) });
  }
};
