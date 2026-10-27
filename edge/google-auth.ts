// Supabase Edge Function "google-auth": confirms a person's Google account ("Sign in with Google").
// The browser sends the Google ID token; we ask Google to verify it, then link / confirm the login.
import { createClient } from "npm:@supabase/supabase-js@2";

const CLIENT_ID = "239588073376-u1pet0b32a3qfbo4824c2tk5n13se5li.apps.googleusercontent.com"; // your Google OAuth Web client ID (public)
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
  let body: { kind?: string; token?: string; credential?: string };
  try { body = await req.json(); } catch { return json({ error: "BAD_REQUEST" }, 400); }
  const { kind, token, credential } = body;
  if (!["login", "link"].includes(kind ?? "") || !token || !credential) return json({ error: "BAD_REQUEST" }, 400);
  if (CLIENT_ID.startsWith("__")) return json({ error: "GOOGLE_NOT_SET_UP" }, 500);

  // Ask Google to verify the token's signature and expiry
  let info: Record<string, string>;
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
    if (!r.ok) return json({ error: "GOOGLE_INVALID" }, 401);
    info = await r.json();
  } catch { return json({ error: "GOOGLE_INVALID" }, 502); }
  const okIss = info.iss === "accounts.google.com" || info.iss === "https://accounts.google.com";
  if (info.aud !== CLIENT_ID || !okIss || String(info.email_verified) !== "true" || !info.email || !info.sub ||
      Number(info.exp) * 1000 < Date.now()) return json({ error: "GOOGLE_INVALID" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const fn = kind === "link" ? "ehh_link_google" : "ehh_google_login";
  const args = kind === "link"
    ? { p_token: token, p_email: info.email, p_sub: info.sub }
    : { p_pending: token, p_email: info.email, p_sub: info.sub };
  const { data, error } = await db.rpc(fn, args);
  if (error) return json({ error: (error.message || "ERROR").trim() }, 400);
  return json(data);
});
