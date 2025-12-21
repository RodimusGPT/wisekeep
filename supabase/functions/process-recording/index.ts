// WiseKeep Process Recording Edge Function
// Handles transcription and summarization via Groq API
// Supports chunked audio for long recordings (1+ hours)
// API key is securely stored in Supabase environment variables

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Types
interface AudioChunk {
  url: string;
  startTime: number;
  endTime: number;
  index: number;
}

interface ProcessRequest {
  recording_id: string;
  user_id: string;
  audio_chunks: AudioChunk[]; // Array of chunks (single item for small recordings)
  language: string;
  duration_seconds: number;
}

interface UsageCheck {
  allowed: boolean;
  tier: string;
  minutes_used: number;
  minutes_limit: number;
  period_type: string;
}

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptionResult {
  text: string;
  segments?: TranscriptionSegment[];
}

interface NoteItem {
  id: string;
  timestamp: number;
  text: string;
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Common Simplified to Traditional Chinese character mappings
// This covers the most frequently used characters that differ between the two
const simplifiedToTraditional: Record<string, string> = {
  // Common verb/action words
  '说': '說', '话': '話', '语': '語', '请': '請', '谢': '謝',
  '认': '認', '识': '識', '让': '讓', '应': '應', '会': '會',
  '这': '這', '那': '那', '里': '裡', '么': '麼', '什': '什',
  '对': '對', '关': '關', '开': '開', '门': '門', '问': '問',
  '听': '聽', '见': '見', '观': '觀', '看': '看', '视': '視',
  '读': '讀', '写': '寫', '学': '學', '习': '習', '练': '練',
  '经': '經', '济': '濟', '过': '過', '时': '時', '间': '間',
  '现': '現', '发': '發', '动': '動', '机': '機', '电': '電',
  '脑': '腦', '网': '網', '络': '絡', '统': '統', '计': '計',
  '设': '設', '备': '備', '术': '術', '专': '專', '业': '業',
  '务': '務', '产': '產', '为': '為', '与': '與', '并': '並',
  '从': '從', '进': '進', '还': '還', '车': '車', '东': '東',
  '西': '西', '南': '南', '北': '北', '国': '國', '际': '際',
  '华': '華', '万': '萬', '亿': '億', '数': '數', '据': '據',
  '报': '報', '导': '導', '团': '團', '队': '隊', '组': '組',
  '织': '織', '个': '個', '们': '們', '您': '您', '体': '體',
  '质': '質', '量': '量', '种': '種', '类': '類', '头': '頭',
  '长': '長', '张': '張', '场': '場', '厂': '廠', '广': '廣',
  '边': '邊', '远': '遠', '运': '運', '输': '輸', '连': '連',
  '结': '結', '构': '構', '来': '來', '变': '變', '样': '樣',
  '标': '標', '准': '準', '规': '規', '则': '則', '条': '條',
  '件': '件', '双': '雙', '单': '單', '简': '簡', '复': '複',
  '杂': '雜', '难': '難', '易': '易', '几': '幾', '医': '醫',
  '药': '藥', '院': '院', '钱': '錢', '银': '銀', '货': '貨',
  '买': '買', '卖': '賣', '价': '價', '贵': '貴', '营': '營',
  '销': '銷', '费': '費', '资': '資', '金': '金', '投': '投',
  '风': '風', '险': '險', '证': '證', '券': '券', '实': '實',
  '验': '驗', '测': '測', '试': '試', '确': '確', '认': '認',
  '后': '後', '节': '節', '点': '點', '线': '線', '面': '面',
};

// Convert Simplified Chinese to Traditional Chinese
function toTraditionalChinese(text: string): string {
  let result = text;
  for (const [simplified, traditional] of Object.entries(simplifiedToTraditional)) {
    result = result.split(simplified).join(traditional);
  }
  return result;
}

// Initialize Supabase client with service role (for database operations)
function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

// Check if user has remaining usage quota
async function checkUsageLimit(supabase: ReturnType<typeof createClient>, userId: string): Promise<UsageCheck> {
  const { data, error } = await supabase.rpc("check_usage_limit", { p_user_id: userId });

  if (error) {
    console.error("Error checking usage limit:", error);
    throw new Error("Failed to check usage limit");
  }

  return data[0];
}

// Update user's usage after recording
async function updateUsage(supabase: ReturnType<typeof createClient>, userId: string, minutes: number): Promise<void> {
  const { error } = await supabase.rpc("update_usage", {
    p_user_id: userId,
    p_minutes: minutes,
  });

  if (error) {
    console.error("Error updating usage:", error);
    throw new Error("Failed to update usage");
  }
}

// Update recording status in database
async function updateRecordingStatus(
  supabase: ReturnType<typeof createClient>,
  recordingId: string,
  status: string,
  updates: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from("recordings")
    .update({ status, ...updates })
    .eq("id", recordingId);

  if (error) {
    console.error("Error updating recording:", error);
    throw new Error("Failed to update recording status");
  }
}

// Transcribe a single audio chunk using Groq Whisper
async function transcribeChunk(audioUrl: string, language: string): Promise<TranscriptionResult> {
  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  // Fetch audio file
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
  }

  const audioBlob = await audioResponse.blob();
  console.log(`Transcribing audio chunk: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);

  // Prepare form data for Groq
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", language === "zh-TW" ? "zh" : language);
  formData.append("response_format", "verbose_json");

  // Call Groq Whisper API
  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq transcription error:", errorText);
    throw new Error(`Transcription failed: ${response.status}`);
  }

  const result = await response.json();

  return {
    text: result.text,
    segments: result.segments?.map((seg: { start: number; end: number; text: string }) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })),
  };
}

// Transcribe all audio chunks and combine results
async function transcribeAllChunks(
  chunks: AudioChunk[],
  language: string
): Promise<{ fullText: string; notes: NoteItem[] }> {
  let fullText = "";
  const allNotes: NoteItem[] = [];
  let noteId = 1;
  const isTraditionalChinese = language === "zh-TW";

  // Sort chunks by index to ensure correct order
  const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);

  for (const chunk of sortedChunks) {
    console.log(`Processing chunk ${chunk.index + 1}/${sortedChunks.length}...`);

    const transcription = await transcribeChunk(chunk.url, language);

    // Convert to Traditional Chinese if needed (Whisper often outputs Simplified)
    let chunkText = transcription.text;
    if (isTraditionalChinese) {
      chunkText = toTraditionalChinese(chunkText);
    }

    // Add space between chunk texts
    if (fullText && chunkText) {
      fullText += " ";
    }
    fullText += chunkText;

    // Convert segments to notes, adjusting timestamps for chunk offset
    if (transcription.segments) {
      for (const segment of transcription.segments) {
        let segmentText = segment.text.trim();
        if (isTraditionalChinese) {
          segmentText = toTraditionalChinese(segmentText);
        }
        allNotes.push({
          id: String(noteId++),
          timestamp: segment.start + chunk.startTime, // Adjust for chunk position
          text: segmentText,
        });
      }
    } else {
      // No segments, create single note for this chunk
      allNotes.push({
        id: String(noteId++),
        timestamp: chunk.startTime,
        text: chunkText,
      });
    }
  }

  return { fullText, notes: allNotes };
}

// Summarize text using Groq Llama
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
      max_tokens: 2048, // Increased for longer recordings
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

    // Convert to Traditional Chinese if needed (safety net in case LLM outputs Simplified)
    if (language === "zh-TW") {
      summaryPoints = summaryPoints.map((point: string) => toTraditionalChinese(point));
    }

    return summaryPoints;
  } catch {
    // If JSON parsing fails, try to extract summary from text
    let result = content;
    if (language === "zh-TW") {
      result = toTraditionalChinese(result);
    }
    return [result];
  }
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    // Parse request
    const body: ProcessRequest = await req.json();
    const { recording_id, user_id, audio_chunks, language, duration_seconds } = body;

    // Validate required fields
    if (!recording_id || !user_id || !audio_chunks || audio_chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const durationMinutes = duration_seconds / 60;
    const chunkCount = audio_chunks.length;

    console.log(`Processing recording ${recording_id}: ${chunkCount} chunk(s), ${durationMinutes.toFixed(1)} minutes`);

    // Check usage limits
    const usageCheck = await checkUsageLimit(supabase, user_id);

    if (!usageCheck.allowed) {
      // User has exceeded their limit
      await updateRecordingStatus(supabase, recording_id, "error", {
        error_message: "Usage limit exceeded",
      });

      return new Response(
        JSON.stringify({
          error: "usage_limit_exceeded",
          message: "You have reached your recording limit for this period",
          usage: {
            minutes_used: usageCheck.minutes_used,
            minutes_limit: usageCheck.minutes_limit,
            period_type: usageCheck.period_type,
            tier: usageCheck.tier,
          },
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await updateRecordingStatus(supabase, recording_id, "processing_notes");

    // Step 1: Transcribe all chunks and combine
    console.log(`Transcribing ${chunkCount} chunk(s)...`);
    const { fullText, notes } = await transcribeAllChunks(audio_chunks, language);

    console.log(`Transcription complete: ${fullText.length} characters, ${notes.length} segments`);

    // Update with notes
    await updateRecordingStatus(supabase, recording_id, "processing_summary", { notes });

    // Step 2: Summarize if there's enough text
    let summary: string[] = [];
    if (fullText.length > 50) {
      console.log(`Summarizing recording ${recording_id}...`);
      summary = await summarizeText(fullText, language);
      console.log(`Summarization complete: ${summary.length} points`);
    }

    // Update with final results
    await updateRecordingStatus(supabase, recording_id, "ready", { summary });

    // Update usage (only for free tier users - VIP/premium don't count against limits)
    if (usageCheck.tier === "free") {
      await updateUsage(supabase, user_id, durationMinutes);
    }

    console.log(`Recording ${recording_id} processed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        recording_id,
        chunk_count: chunkCount,
        notes_count: notes.length,
        summary_points: summary.length,
        usage: usageCheck.tier === "free" ? {
          minutes_used: usageCheck.minutes_used + durationMinutes,
          minutes_limit: usageCheck.minutes_limit,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing recording:", error);

    return new Response(
      JSON.stringify({
        error: "processing_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
