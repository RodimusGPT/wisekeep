// Recording duration limits by tier
// Normal users: 20 min hard limit (fits in Groq's 25MB)
// VIP users: Unlimited via auto-chunking every 20 minutes
//
// DEV: Set to 30 seconds for testing auto-chunking. Change back to 20*60 for production.
const DEV_CHUNK_DURATION = 30; // seconds - for testing auto-chunk
const PROD_CHUNK_DURATION = 20 * 60; // 20 minutes - for production

// Toggle this for testing vs production
const USE_DEV_DURATION = false; // Set to false for production

const CHUNK_DURATION = USE_DEV_DURATION ? DEV_CHUNK_DURATION : PROD_CHUNK_DURATION;

export const RECORDING_LIMITS = {
  // Maximum single recording duration (before auto-chunk or stop)
  CHUNK_DURATION_SECONDS: {
    free: CHUNK_DURATION,   // hard limit, then stops
    vip: CHUNK_DURATION,    // auto-saves chunk, continues recording
    premium: CHUNK_DURATION, // auto-saves chunk, continues recording
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
