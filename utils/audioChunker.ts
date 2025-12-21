// Audio Chunking Utility
// Splits large audio files into smaller chunks for processing
// This allows us to work within Supabase Free tier's 50MB upload limit
// and Groq's 25MB file size limit

// Constants
const MAX_CHUNK_SIZE_MB = 20; // Stay well under Groq's 25MB limit
const MAX_CHUNK_SIZE_BYTES = MAX_CHUNK_SIZE_MB * 1024 * 1024;
const CHUNK_DURATION_MINUTES = 40; // Approximate chunk duration

export interface AudioChunk {
  index: number;
  blob: Blob;
  startTime: number; // in seconds
  endTime: number; // in seconds
  isLast: boolean;
}

export interface ChunkingResult {
  chunks: AudioChunk[];
  totalDuration: number;
  needsChunking: boolean;
}

/**
 * Check if an audio blob needs to be chunked
 */
export function needsChunking(audioBlob: Blob): boolean {
  return audioBlob.size > MAX_CHUNK_SIZE_BYTES;
}

/**
 * Get chunk info without actually chunking (for planning)
 */
export function getChunkPlan(audioBlob: Blob, durationSeconds: number): {
  chunkCount: number;
  needsChunking: boolean;
  chunkDurationSeconds: number;
} {
  if (!needsChunking(audioBlob)) {
    return {
      chunkCount: 1,
      needsChunking: false,
      chunkDurationSeconds: durationSeconds,
    };
  }

  // Estimate number of chunks based on file size
  const estimatedChunks = Math.ceil(audioBlob.size / MAX_CHUNK_SIZE_BYTES);
  const chunkDuration = durationSeconds / estimatedChunks;

  return {
    chunkCount: estimatedChunks,
    needsChunking: true,
    chunkDurationSeconds: chunkDuration,
  };
}

/**
 * Split an audio blob into chunks
 * Uses time-based splitting to avoid cutting mid-word
 *
 * Note: For WebM/Opus, we can't easily split by time on client-side
 * So we split by byte size, which may cut mid-frame
 * The server-side transcription handles this gracefully
 */
export async function chunkAudioBlob(
  audioBlob: Blob,
  durationSeconds: number
): Promise<ChunkingResult> {
  // If small enough, return as single chunk
  if (!needsChunking(audioBlob)) {
    return {
      chunks: [{
        index: 0,
        blob: audioBlob,
        startTime: 0,
        endTime: durationSeconds,
        isLast: true,
      }],
      totalDuration: durationSeconds,
      needsChunking: false,
    };
  }

  const chunks: AudioChunk[] = [];
  const arrayBuffer = await audioBlob.arrayBuffer();
  const totalBytes = arrayBuffer.byteLength;
  const bytesPerSecond = totalBytes / durationSeconds;

  let offset = 0;
  let chunkIndex = 0;
  let currentTime = 0;

  while (offset < totalBytes) {
    // Calculate chunk size
    const remainingBytes = totalBytes - offset;
    const chunkSize = Math.min(MAX_CHUNK_SIZE_BYTES, remainingBytes);

    // Calculate time range for this chunk
    const chunkDuration = chunkSize / bytesPerSecond;
    const startTime = currentTime;
    const endTime = currentTime + chunkDuration;

    // Extract chunk bytes
    const chunkBytes = arrayBuffer.slice(offset, offset + chunkSize);
    const chunkBlob = new Blob([chunkBytes], { type: audioBlob.type });

    chunks.push({
      index: chunkIndex,
      blob: chunkBlob,
      startTime,
      endTime,
      isLast: offset + chunkSize >= totalBytes,
    });

    offset += chunkSize;
    chunkIndex++;
    currentTime = endTime;
  }

  console.log(`Audio chunked into ${chunks.length} parts:`,
    chunks.map(c => `Chunk ${c.index}: ${(c.blob.size / 1024 / 1024).toFixed(1)}MB, ${c.startTime.toFixed(0)}-${c.endTime.toFixed(0)}s`)
  );

  return {
    chunks,
    totalDuration: durationSeconds,
    needsChunking: true,
  };
}

/**
 * Combine transcription segments from multiple chunks
 * Adjusts timestamps to be continuous
 */
export interface TranscriptionSegment {
  id: string;
  timestamp: number;
  text: string;
}

export function combineTranscriptions(
  chunkTranscriptions: Array<{
    text: string;
    segments: TranscriptionSegment[];
    chunkStartTime: number;
  }>
): { fullText: string; combinedSegments: TranscriptionSegment[] } {
  let fullText = '';
  const combinedSegments: TranscriptionSegment[] = [];
  let segmentId = 1;

  for (const chunk of chunkTranscriptions) {
    // Add space between chunk texts
    if (fullText && chunk.text) {
      fullText += ' ';
    }
    fullText += chunk.text;

    // Adjust segment timestamps and add to combined list
    for (const segment of chunk.segments) {
      combinedSegments.push({
        id: String(segmentId++),
        timestamp: segment.timestamp + chunk.chunkStartTime,
        text: segment.text,
      });
    }
  }

  return { fullText, combinedSegments };
}
