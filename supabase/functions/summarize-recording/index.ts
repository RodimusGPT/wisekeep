// WiseKeep Summarize Recording Edge Function
// Generates summary from existing notes (when transcription succeeded but summary failed)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface SummarizeRequest {
  recording_id: string;
  user_id: string;
  language: string;
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simplified to Traditional Chinese character mappings (subset for summary)
const simplifiedToTraditional: Record<string, string> = {
  '说': '說', '话': '話', '语': '語', '请': '請', '谢': '謝',
  '认': '認', '识': '識', '让': '讓', '应': '應', '会': '會',
  '这': '這', '里': '裡', '么': '麼', '对': '對', '关': '關',
  '开': '開', '门': '門', '问': '問', '听': '聽', '见': '見',
  '观': '觀', '视': '視', '读': '讀', '写': '寫', '学': '學',
  '时': '時', '间': '間', '现': '現', '发': '發', '动': '動',
  '机': '機', '电': '電', '脑': '腦', '网': '網', '络': '絡',
  '经': '經', '济': '濟', '过': '過', '进': '進', '还': '還',
  '国': '國', '华': '華', '万': '萬', '数': '數', '报': '報',
  '个': '個', '们': '們', '体': '體', '质': '質', '种': '種',
  '类': '類', '头': '頭', '长': '長', '场': '場', '广': '廣',
  '来': '來', '变': '變', '样': '樣', '后': '後', '点': '點',
  '线': '線', '节': '節', '单': '單', '简': '簡', '难': '難',
  '医': '醫', '药': '藥', '钱': '錢', '买': '買', '卖': '賣',
  '价': '價', '费': '費', '资': '資', '风': '風', '险': '險',
  '证': '證', '实': '實', '验': '驗', '确': '確', '为': '為',
  '与': '與', '并': '並', '从': '從', '业': '業', '产': '產',
};

function toTraditionalChinese(text: string): string {
  let result = text;
  for (const [simplified, traditional] of Object.entries(simplifiedToTraditional)) {
    result = result.split(simplified).join(traditional);
  }
  return result;
}

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

async function summarizeText(text: string, language: string): Promise<string[]> {
  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const systemPrompt =
    language === "zh-TW"
      ? `你是一個專業的會議記錄助手。請將以下錄音逐字稿整理成重點摘要。

重要要求：
- 必須使用台灣繁體中文（Traditional Chinese），絕對不可以使用简体中文（Simplified Chinese）
- 例如：使用「這」而非「这」，使用「說」而非「说」，使用「會」而非「会」
- 提取3-7個最重要的重點
- 每個重點用一句話概括
- 保持客觀，不添加原文沒有的資訊
- 返回JSON格式：{"summary": ["重點1", "重點2", ...]}`
      : `You are a professional meeting notes assistant. Please summarize the following transcript into key points.
Requirements:
- Extract 3-7 most important points
- Summarize each point in one sentence
- Stay objective, don't add information not in the original
- Return JSON format: {"summary": ["point1", "point2", ...]}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq summarization error:", errorText);
    throw new Error(`Summarization failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content;

  try {
    const parsed = JSON.parse(content);
    let summaryPoints = parsed.summary || [];

    if (language === "zh-TW") {
      summaryPoints = summaryPoints.map((point: string) => toTraditionalChinese(point));
    }

    return summaryPoints;
  } catch {
    let result = content;
    if (language === "zh-TW") {
      result = toTraditionalChinese(result);
    }
    return [result];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const body: SummarizeRequest = await req.json();
    const { recording_id, user_id, language } = body;

    if (!recording_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${recording_id}] Starting summarization...`);

    // Fetch the recording to get notes
    const { data: recording, error: fetchError } = await supabase
      .from("recordings")
      .select("notes, status")
      .eq("id", recording_id)
      .single();

    if (fetchError || !recording) {
      console.error("Error fetching recording:", fetchError);
      return new Response(
        JSON.stringify({ error: "Recording not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recording.notes || recording.notes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No notes to summarize" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase
      .from("recordings")
      .update({ status: "processing_summary" })
      .eq("id", recording_id);

    // Combine notes into full text
    const fullText = recording.notes
      .map((note: { text: string }) => note.text)
      .join(" ");

    console.log(`[${recording_id}] Summarizing ${fullText.length} chars...`);

    // Generate summary
    const summary = await summarizeText(fullText, language || "zh-TW");

    console.log(`[${recording_id}] Summary generated: ${summary.length} points`);

    // Update recording with summary
    const { error: updateError } = await supabase
      .from("recordings")
      .update({ summary, status: "ready" })
      .eq("id", recording_id);

    if (updateError) {
      console.error("Error updating recording:", updateError);
      throw new Error("Failed to save summary");
    }

    return new Response(
      JSON.stringify({
        success: true,
        recording_id,
        summary_points: summary.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Summarization error:", errorMessage);

    return new Response(
      JSON.stringify({ error: "summarization_failed", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
