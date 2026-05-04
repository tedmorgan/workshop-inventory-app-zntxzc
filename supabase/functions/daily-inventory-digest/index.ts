/**
 * Daily digest: email when new users or new tools appear in the rolling window.
 *
 * Secrets (Dashboard → Edge Functions → daily-inventory-digest → Secrets):
 *   RESEND_API_KEY   — https://resend.com (send API)
 *   CRON_SECRET      — send as: Query param "key" (?key=), header X-Cron-Secret, or header "key", or Authorization: Bearer (Dashboard often overwrites Authorization — use Query params or X-Cron-Secret)
 * Optional: DIGEST_TO_EMAIL (default tedmorgan@gmail.com), DIGEST_FROM_EMAIL, DIGEST_WINDOW_HOURS (default 24)
 *
 * Schedule: Dashboard → Edge Functions → Schedules, or use supabase/cron_daily_digest.example.sql
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, key",
};

type DigestStats = {
  new_users: number;
  new_tools: number;
  total_users: number;
  total_tools: number;
};

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecretRaw = Deno.env.get("CRON_SECRET");
  const cronSecret = cronSecretRaw?.trim();
  if (cronSecret) {
    const auth = req.headers.get("Authorization");
    const url = new URL(req.url);
    // Query string: ?key=secret (this is NOT the same as an HTTP header named "key")
    const keyQuery = url.searchParams.get("key")?.trim();
    const headerSecret =
      req.headers.get("X-Cron-Secret")?.trim() ??
      req.headers.get("x-cron-secret")?.trim();
    // Some testers send the secret as a header literally named "key"
    const keyHeader =
      req.headers.get("key")?.trim() ?? req.headers.get("Key")?.trim();
    const ok =
      auth === `Bearer ${cronSecret}` ||
      keyQuery === cronSecret ||
      headerSecret === cronSecret ||
      keyHeader === cronSecret;
    if (!ok) {
      return unauthorized();
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const toEmail =
    Deno.env.get("DIGEST_TO_EMAIL") ?? "tedmorgan@gmail.com";
  const fromEmail =
    Deno.env.get("DIGEST_FROM_EMAIL") ??
    "Workshop Inventory <onboarding@resend.dev>";

  const windowHours = Number(Deno.env.get("DIGEST_WINDOW_HOURS") ?? "24");
  const since = new Date(
    Date.now() - windowHours * 60 * 60 * 1000,
  ).toISOString();

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("get_inventory_digest_stats", {
    since_ts: since,
  });

  if (error) {
    console.error("digest rpc error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stats = data as DigestStats;
  const newUsers = stats.new_users ?? 0;
  const newTools = stats.new_tools ?? 0;

  if (newUsers === 0 && newTools === 0) {
    return new Response(
      JSON.stringify({
        sent: false,
        reason: "no_new_activity",
        since,
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!resendKey) {
    console.error("RESEND_API_KEY not set; cannot send digest email");
    return new Response(
      JSON.stringify({
        error:
          "RESEND_API_KEY is not configured. Set it in Edge Function secrets.",
        stats,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const subject = `Workshop Inventory: ${newUsers} new user(s), ${newTools} new tool(s)`;
  const text = [
    `Daily digest (rolling last ${windowHours} hours)`,
    ``,
    `New users (first activity in window): ${newUsers}`,
    `New tools (on rows created in window): ${newTools}`,
    ``,
    `All-time totals — users: ${stats.total_users}, tools: ${stats.total_tools}`,
    ``,
    `Window start (UTC): ${since}`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend error:", res.status, errText);
    return new Response(
      JSON.stringify({ error: "Resend failed", details: errText }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const resendJson = await res.json();
  return new Response(
    JSON.stringify({
      sent: true,
      since,
      stats,
      resend: resendJson,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
