// WiseKeep Check Usage Edge Function
// Returns user's current usage and limits

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user info
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("tier, subscription_status, subscription_expires_at")
      .eq("id", user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get usage limits
    const { data: usageData, error: usageError } = await supabase.rpc("check_usage_limit", {
      p_user_id: user_id,
    });

    if (usageError) {
      throw usageError;
    }

    const usage = usageData[0];

    return new Response(
      JSON.stringify({
        tier: usage.tier,
        allowed: usage.allowed,
        minutes_used: usage.minutes_used,
        minutes_limit: usage.minutes_limit,
        minutes_remaining: usage.minutes_limit === -1 ? -1 : Math.max(0, usage.minutes_limit - usage.minutes_used),
        period_type: usage.period_type,
        is_unlimited: usage.minutes_limit === -1,
        subscription: user.tier === "premium" ? {
          status: user.subscription_status,
          expires_at: user.subscription_expires_at,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking usage:", error);
    return new Response(
      JSON.stringify({ error: "Failed to check usage" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
