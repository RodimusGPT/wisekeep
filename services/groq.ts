// Groq API service for transcription and summarization
// Using Whisper for speech-to-text and Llama for summarization

import Constants from 'expo-constants';

// API key is loaded from environment variables (.env file)
// For security, the .env file is gitignored and never committed
const GROQ_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_GROQ_API_KEY ||
                     process.env.EXPO_PUBLIC_GROQ_API_KEY;

const GROQ_API_URL = 'https://api.groq.com/openai/v1';

if (!GROQ_API_KEY) {
  console.error('GROQ API key not found. Please set EXPO_PUBLIC_GROQ_API_KEY in .env file');
}

export interface TranscriptionResult {
  text: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface SummarizationResult {
  summary: string[];
}

/**
 * Normalize audio MIME type to standard format
 * Groq API accepts: audio/webm, audio/mp4, audio/wav, audio/mpeg
 */
function normalizeAudioMimeType(blobType: string): { extension: string; mimeType: string } {
  const type = blobType.toLowerCase();

  // M4A/AAC formats (iOS) -> use audio/mp4
  if (type.includes('m4a') || type.includes('mp4') || type.includes('aac') || type.includes('mpeg4')) {
    return { extension: 'm4a', mimeType: 'audio/mp4' };
  }

  // WebM (web recording)
  if (type.includes('webm')) {
    return { extension: 'webm', mimeType: 'audio/webm' };
  }

  // WAV
  if (type.includes('wav')) {
    return { extension: 'wav', mimeType: 'audio/wav' };
  }

  // MPEG/MP3
  if (type.includes('mpeg') || type.includes('mp3')) {
    return { extension: 'mp3', mimeType: 'audio/mpeg' };
  }

  // Default to webm for unknown
  return { extension: 'webm', mimeType: 'audio/webm' };
}

/**
 * Transcribe audio using Groq's Whisper API
 */
export async function transcribeAudio(
  audioBlob: Blob,
  language: string = 'zh'
): Promise<TranscriptionResult> {
  const formData = new FormData();

  // Normalize MIME type to standard format accepted by Groq
  const { extension, mimeType } = normalizeAudioMimeType(audioBlob.type || '');

  console.log(`[Groq] Original blob type: ${audioBlob.type}, normalized to: ${mimeType}`);

  // Create a File object with normalized MIME type
  const audioFile = new File([audioBlob], `recording.${extension}`, { type: mimeType });

  formData.append('file', audioFile);
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');

  // Map language codes
  const langMap: Record<string, string> = {
    'zh-TW': 'zh',
    'zh-CN': 'zh',
    'en': 'en',
  };
  formData.append('language', langMap[language] || 'zh');

  console.log('Sending audio to Groq Whisper API...', {
    size: audioBlob.size,
    type: mimeType,
  });

  const response = await fetch(`${GROQ_API_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Groq transcription error:', errorText);
    throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Transcription result:', result);

  return {
    text: result.text,
    segments: result.segments?.map((seg: any) => ({
      start: Math.floor(seg.start * 1000), // Convert to milliseconds
      end: Math.floor(seg.end * 1000),
      text: seg.text,
    })),
  };
}

/**
 * Summarize transcribed text using Groq's Llama API
 */
export async function summarizeText(
  text: string,
  language: string = 'zh-TW'
): Promise<SummarizationResult> {
  const isChineseUI = language.startsWith('zh');

  const systemPrompt = isChineseUI
    ? `你是一個專業的摘要助手。請將以下錄音內容整理成3-5個重點摘要。
每個重點應該簡潔明瞭，突出關鍵信息。
請直接輸出重點，每個重點一行，不需要編號或其他格式。`
    : `You are a professional summarization assistant. Please summarize the following recording into 3-5 key points.
Each point should be concise and highlight key information.
Output the points directly, one per line, without numbering or other formatting.`;

  const userPrompt = isChineseUI
    ? `請摘要以下錄音內容：\n\n${text}`
    : `Please summarize the following recording:\n\n${text}`;

  console.log('Sending text to Groq Llama API for summarization...');

  const response = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Groq summarization error:', errorText);
    throw new Error(`Summarization failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Summarization result:', result);

  const summaryText = result.choices[0]?.message?.content || '';

  // Split into individual points, filtering empty lines
  const summary = summaryText
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .slice(0, 5); // Limit to 5 points

  return { summary };
}

/**
 * Fetch audio from URI and convert to Blob
 */
export async function fetchAudioBlob(audioUri: string): Promise<Blob> {
  // For web blob URLs, we can fetch directly
  if (audioUri.startsWith('blob:')) {
    const response = await fetch(audioUri);
    return response.blob();
  }

  // For file:// URIs (native), this would need different handling
  // For now, we'll throw an error as we're focused on web
  throw new Error('Non-blob audio URIs not supported on web');
}
