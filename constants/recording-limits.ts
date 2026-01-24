// Recording duration limits by tier
// Normal users: 25 min hard limit (fits in Groq's 25MB)
// VIP users: Unlimited via auto-chunking every 20 minutes

export const RECORDING_LIMITS = {
  // Maximum single recording duration (before auto-chunk or stop)
  CHUNK_DURATION_SECONDS: {
    free: 25 * 60,        // 25 minutes - hard limit, then stops
    vip: 20 * 60,         // 20 minutes - auto-saves chunk, continues recording
    premium: 20 * 60,     // 20 minutes - auto-saves chunk, continues recording
  },

  // Whether tier allows multi-part recordings
  ALLOWS_MULTI_PART: {
    free: false,          // Single recording only
    vip: true,            // Unlimited via chunking
    premium: true,        // Unlimited via chunking
  },
};

// Get chunk duration for a tier
export function getChunkDuration(tier: string): number {
  const limits = RECORDING_LIMITS.CHUNK_DURATION_SECONDS;
  return limits[tier as keyof typeof limits] || limits.free;
}

// Check if tier allows multi-part recordings
export function allowsMultiPart(tier: string): boolean {
  const allows = RECORDING_LIMITS.ALLOWS_MULTI_PART;
  return allows[tier as keyof typeof allows] || false;
}
