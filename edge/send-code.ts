// Supabase Edge Function "send-code": emails a 6-digit confirmation code through Gmail.
// Secrets needed (Supabase > Edge Functions > Secrets): GMAIL_USER, GMAIL_APP_PASSWORD
import nodemailer from "npm:nodemailer@6.9.14";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "BAD_REQUEST" }, 405);
  let body: { kind?: string; token?: string; email?: string };
  try { body = await req.json(); } catch { return json({ error: "BAD_REQUEST" }, 400); }
  const { kind, token, email } = body;
  if (!["login", "link"].includes(kind ?? "") || !token) return json({ error: "BAD_REQUEST" }, 400);

  const user = Deno.env.get("GMAIL_USER"), pass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass) return json({ error: "MAIL_NOT_SET_UP", detail: "Missing secret: " + [!user && "GMAIL_USER", !pass && "GMAIL_APP_PASSWORD"].filter(Boolean).join(" and ") }, 500);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc("ehh_issue_code", { p_token: token, p_purpose: kind, p_email: email ?? null });
  if (error) return json({ error: (error.message || "ERROR").trim() }, 400);

  try {
    const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
    const why = kind === "login" ? "log in to" : "link this Gmail to your";
    await t.sendMail({
      from: `"EduHealthHub" <${user}>`,
      to: data.email,
      subject: `Your EduHealthHub code: ${data.code}`,
      text: `Hello ${data.name},\n\nYour confirmation code to ${why} EduHealthHub is:\n\n    ${data.code}\n\nIt works for 10 minutes. If you did not ask for it, ignore this email and do not share the code.\n\nEduHealthHub`,
      html: `<div style="font-family:Arial,sans-serif;max-width:420px"><h2 style="color:#2d4a3a">EduHealthHub</h2><p>Hello ${String(data.name).replace(/[<>&]/g, "")},</p><p>Your confirmation code to ${why} EduHealthHub is:</p><p style="font-size:32px;letter-spacing:6px;font-weight:bold;color:#2d4a3a">${data.code}</p><p style="color:#555">It works for 10 minutes. If you did not ask for it, ignore this email and do not share the code.</p></div>`,
    });
  } catch (e) {
    console.error("mail failed:", (e as Error).message);
    await db.from("email_codes").delete().eq("id", data.id); // so the person can retry right away
    return json({ error: "MAIL_FAILED", detail: String((e as Error).message).slice(0, 120) }, 502);
  }
  const m = String(data.email);
  return json({ ok: true, hint: m[0] + "***" + m.slice(m.indexOf("@")) });
});
