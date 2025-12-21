// WiseKeep Get Config Edge Function
// Returns app configuration for pricing, limits, and features

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

    // Get all public config values
    const { data, error } = await supabase
      .from("app_config")
      .select("key, value");

    if (error) {
      throw error;
    }

    // Transform to key-value object and parse JSON values
    const config: Record<string, unknown> = {};
    for (const row of data || []) {
      try {
        config[row.key] = JSON.parse(row.value);
      } catch {
        config[row.key] = row.value;
      }
    }

    return new Response(
      JSON.stringify({
        // Free tier
        free_tier: {
          minutes: config.free_tier_minutes,
          period: config.free_tier_period,
        },
        // Premium pricing
        premium: {
          monthly_price_twd: config.premium_monthly_price_twd,
          yearly_price_twd: config.premium_yearly_price_twd,
          yearly_savings_twd: config.premium_yearly_savings_twd,
        },
        // Limits
        limits: {
          max_recording_duration_minutes: config.max_recording_duration_minutes,
          max_audio_file_size_mb: config.max_audio_file_size_mb,
        },
        // Features
        features: {
          allow_anonymous_recording: config.allow_anonymous_recording,
          auto_transcribe: config.auto_transcribe,
          auto_summarize: config.auto_summarize,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching config:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch config" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
