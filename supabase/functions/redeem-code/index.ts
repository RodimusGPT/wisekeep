// WiseKeep Redeem Invite Code Edge Function
// Validates and applies invite codes to grant VIP access

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
    const { user_id, code } = await req.json();

    if (!user_id || !code) {
      return new Response(
        JSON.stringify({ error: "user_id and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the redeem function
    const { data, error } = await supabase.rpc("redeem_invite_code", {
      p_user_id: user_id,
      p_code: code.toUpperCase().trim(),
    });

    if (error) {
      throw error;
    }

    const result = data[0];

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, message: result.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: result.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error redeeming code:", error);
    return new Response(
      JSON.stringify({ error: "Failed to redeem code" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
