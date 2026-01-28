// Supabase client service
// Handles authentication, storage, and Edge Function calls

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { decode } from 'base-64';
// Note: Client-side chunking removed - server handles large files via Google STT

/**
 * Get the appropriate file extension and content type for an audio blob
 * Handles both web (webm) and native iOS (m4a) formats
 * CRITICAL: Normalizes non-standard MIME types to standard ones accepted by Supabase
 */
function getAudioFormat(blob: Blob): { extension: string; contentType: string } {
  const blobType = blob.type?.toLowerCase() || '';

  console.log(`[getAudioFormat] Input blob type: "${blobType}", Platform: ${Platform.OS}`);

  // Handle M4A/AAC formats (iOS native recording)
  // Matches: audio/x-m4a, audio/m4a, audio/mp4, audio/aac, audio/mpeg4, etc.
  if (blobType.includes('m4a') || blobType.includes('mp4') || blobType.includes('aac') || blobType.includes('mpeg4')) {
    console.log('[getAudioFormat] Detected M4A/AAC format, using audio/mp4');
    return { extension: 'm4a', contentType: 'audio/mp4' };
  }

  // Handle WebM format (web recording)
  if (blobType.includes('webm')) {
    console.log('[getAudioFormat] Detected WebM format');
    return { extension: 'webm', contentType: 'audio/webm' };
  }

  // Handle WAV format
  if (blobType.includes('wav')) {
    console.log('[getAudioFormat] Detected WAV format');
    return { extension: 'wav', contentType: 'audio/wav' };
  }

  // Handle MPEG/MP3 format
  if (blobType.includes('mpeg') || blobType.includes('mp3')) {
    console.log('[getAudioFormat] Detected MPEG format');
    return { extension: 'mp3', contentType: 'audio/mpeg' };
  }

  // Default based on platform - iOS always uses m4a, web uses webm
  if (Platform.OS === 'web') {
    console.log('[getAudioFormat] Unknown type on web, defaulting to webm');
    return { extension: 'webm', contentType: 'audio/webm' };
  }

  // iOS/Android default to m4a with standard audio/mp4 MIME type
  console.log('[getAudioFormat] Unknown type on native, defaulting to m4a with audio/mp4');
  return { extension: 'm4a', contentType: 'audio/mp4' };
}

// Get Supabase credentials from environment
const SUPABASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL ||
                     process.env.EXPO_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
                          process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase credentials not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env file');
}

// Create a storage adapter that works on both web and native
const createStorageAdapter = () => {
  // On web, use localStorage directly
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        localStorage.removeItem(key);
        return Promise.resolve();
      },
    };
  }

  // On native, use AsyncStorage (imported dynamically to avoid SSR issues)
  // For SSR/prerendering, return a no-op storage
  if (typeof window === 'undefined') {
    return {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    };
  }

  // Native platforms - import AsyncStorage
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage;
};

// Create Supabase client with platform-appropriate storage
// This is for the USER app (anonymous auth, recordings, etc.)
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || '',
  {
    auth: {
      storage: createStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Create a SEPARATE Supabase client for ADMIN panel
// Uses a different storageKey so admin and user sessions are completely isolated
// This means:
// - User logging in/out doesn't affect admin session
// - Admin logging in/out doesn't affect user session
// - Future: users can have email auth without conflicting with admin
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || '',
  {
    auth: {
      storage: createStorageAdapter(),
      storageKey: 'wisekeep-admin-auth', // Different storage key!
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Types
export interface AppConfig {
  free_tier: {
    minutes: number;
    period: string;
  };
  premium: {
    monthly_price_twd: number;
    yearly_price_twd: number;
    yearly_savings_twd: number;
  };
  limits: {
    max_recording_duration_minutes: number;
    max_audio_file_size_mb: number;
  };
  features: {
    allow_anonymous_recording: boolean;
    auto_transcribe: boolean;
    auto_summarize: boolean;
  };
}

export interface UsageInfo {
  tier: 'free' | 'vip' | 'premium';
  allowed: boolean;
  minutes_used: number;
  minutes_limit: number;
  minutes_remaining: number;
  period_type: string;
  is_unlimited: boolean;
}

// New interface for comprehensive usage including storage limits
export interface ComprehensiveUsage {
  tier: 'free' | 'vip' | 'premium';
  can_record: boolean;
  can_process: boolean;
  ai_minutes_used: number;
  ai_minutes_limit: number;
  ai_minutes_remaining: number;
  storage_used: number;
  storage_limit: number;
  storage_remaining: number;
  period_start: string;
}

export interface UserProfile {
  id: string;
  tier: 'free' | 'vip' | 'premium';
  device_id: string | null;
  support_code: string | null;
  invite_code_used: string | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
}

// ============================================
// Authentication
// ============================================

/**
 * Sign in anonymously - creates a new user or restores existing session
 */
export async function signInAnonymously(): Promise<{ userId: string }> {
  // Check for existing session
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    return { userId: session.user.id };
  }

  // Create new anonymous user
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error('Anonymous sign in error:', error);
    throw error;
  }

  if (!data.user) {
    throw new Error('No user returned from anonymous sign in');
  }

  return { userId: data.user.id };
}

/**
 * Get or create user profile in database
 * Uses a SECURITY DEFINER function to bypass RLS for session recovery
 * Handles the case where auth session changes but device stays the same
 */
export async function ensureUserProfile(authUserId: string, deviceId: string): Promise<UserProfile> {
  // Use the RPC function that bypasses RLS
  const { data, error } = await supabase.rpc('get_or_create_user', {
    p_auth_user_id: authUserId,
    p_device_id: deviceId,
  });

  if (error) {
    console.error('Error in get_or_create_user:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('No user returned from get_or_create_user');
  }

  // RPC returns an array, get the first (and only) row
  const user = data[0];

  // Validate required fields before casting
  if (!user?.id || typeof user.id !== 'string') {
    throw new Error('Invalid user profile: missing or invalid id');
  }
  if (!user?.tier || typeof user.tier !== 'string') {
    throw new Error('Invalid user profile: missing or invalid tier');
  }

  return user as UserProfile;
}

/**
 * Get current user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

// ============================================
// Configuration
// ============================================

/**
 * Fetch app configuration from Edge Function
 */
export async function getAppConfig(): Promise<AppConfig> {
  const { data, error } = await supabase.functions.invoke('get-config');

  if (error) {
    console.error('Error fetching config:', error);
    throw error;
  }

  return data as AppConfig;
}

// ============================================
// Usage Tracking
// ============================================

/**
 * Check user's current usage and limits
 */
export async function checkUsage(userId: string): Promise<UsageInfo> {
  const { data, error } = await supabase.functions.invoke('check-usage', {
    body: { user_id: userId },
  });

  if (error) {
    console.error('Error checking usage:', error);
    throw error;
  }

  return data as UsageInfo;
}

/**
 * Check comprehensive usage including storage and AI processing limits
 * Uses the new check_usage database function with storage limits
 */
export async function checkComprehensiveUsage(userId: string): Promise<ComprehensiveUsage> {
  const { data, error } = await supabase.rpc('check_usage', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error checking comprehensive usage:', error);
    throw error;
  }

  return data as ComprehensiveUsage;
}

// ============================================
// Invite Codes
// ============================================

/**
 * Redeem an invite code to get VIP access
 */
export async function redeemInviteCode(userId: string, code: string): Promise<{ success: boolean; message: string }> {
  // Basic input validation
  if (!code || typeof code !== 'string') {
    return { success: false, message: 'Invalid code format' };
  }

  const trimmedCode = code.trim();
  if (trimmedCode.length < 4 || trimmedCode.length > 20) {
    return { success: false, message: 'Code must be 4-20 characters' };
  }

  const { data, error } = await supabase.functions.invoke('redeem-code', {
    body: { user_id: userId, code: trimmedCode },
  });

  if (error) {
    console.error('Error redeeming code:', error);
    throw error;
  }

  return data as { success: boolean; message: string };
}

// ============================================
// Storage
// ============================================

/**
 * Upload audio file to Supabase Storage
 * Accepts either a Blob (web) or base64 string (React Native)
 */
export async function uploadAudio(
  userId: string,
  recordingId: string,
  audioData: Blob | string, // Blob for web, base64 string for native
  mimeType?: string // Required when passing base64 string
): Promise<string> {
  let extension: string;
  let contentType: string;
  let uploadData: Blob | ArrayBuffer;

  if (typeof audioData === 'string') {
    // React Native: audioData is base64 string
    // Supabase supports ArrayBuffer uploads which work better than Blob on RN
    console.log(`[uploadAudio] Uploading base64 data, length: ${audioData.length}`);

    extension = 'm4a'; // iOS recordings are m4a
    contentType = mimeType || 'audio/mp4';

    // Convert base64 to ArrayBuffer using decode option
    // Supabase storage accepts { decode: 'base64' } but it's not in the types
    // Instead, we'll convert to ArrayBuffer manually
    const binaryString = decode(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    uploadData = bytes.buffer;

    console.log(`[uploadAudio] Converted to ArrayBuffer, size: ${uploadData.byteLength} bytes`);
  } else {
    // Web: audioData is Blob
    const format = getAudioFormat(audioData);
    extension = format.extension;
    contentType = format.contentType;
    uploadData = audioData;
    console.log(`[uploadAudio] Blob type: ${audioData.type}, uploading as: ${contentType}`);
  }

  const fileName = `${userId}/${recordingId}.${extension}`;

  const { data, error } = await supabase.storage
    .from('recordings')
    .upload(fileName, uploadData, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('Error uploading audio:', error);
    throw error;
  }

  // Get signed URL
  const { data: urlData } = await supabase.storage
    .from('recordings')
    .createSignedUrl(fileName, 60 * 60 * 24); // 24 hour expiry

  if (!urlData?.signedUrl) {
    throw new Error('Failed to get signed URL for uploaded audio');
  }

  return urlData.signedUrl;
}

/**
 * Extract the storage path from a Supabase signed URL
 * E.g., "https://xxx.supabase.co/storage/v1/object/sign/recordings/user123/rec456.m4a?token=..."
 *       -> "user123/rec456.m4a"
 */
function extractPathFromSignedUrl(signedUrl: string): string | null {
  try {
    // The path is after "/recordings/" and before "?" query params
    const match = signedUrl.match(/\/recordings\/([^?]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Regenerate a fresh signed URL from an existing (possibly expired) signed URL
 * This extracts the actual file path and creates a new signed URL
 */
export async function refreshSignedUrl(existingUrl: string): Promise<string> {
  const path = extractPathFromSignedUrl(existingUrl);
  if (!path) {
    throw new Error('Could not extract path from existing URL');
  }

  console.log(`[refreshSignedUrl] Regenerating signed URL for path: ${path}`);

  const { data, error } = await supabase.storage
    .from('recordings')
    .createSignedUrl(path, 60 * 60); // 1 hour expiry

  if (error || !data?.signedUrl) {
    console.error('[refreshSignedUrl] Error:', error);
    throw new Error('Failed to create fresh signed URL');
  }

  return data.signedUrl;
}

/**
 * Get signed URL for an audio file
 * Tries platform-appropriate extension first, then falls back to the other
 * NOTE: This guesses the path - prefer refreshSignedUrl() when you have the original URL
 */
export async function getAudioUrl(userId: string, recordingId: string): Promise<string> {
  // Try platform-appropriate extension first
  const primaryExt = Platform.OS === 'web' ? 'webm' : 'm4a';
  const fallbackExt = Platform.OS === 'web' ? 'm4a' : 'webm';

  // Try primary extension
  const primaryFileName = `${userId}/${recordingId}.${primaryExt}`;
  const { data, error } = await supabase.storage
    .from('recordings')
    .createSignedUrl(primaryFileName, 60 * 60); // 1 hour expiry

  if (data?.signedUrl) {
    return data.signedUrl;
  }

  // Try fallback extension
  const fallbackFileName = `${userId}/${recordingId}.${fallbackExt}`;
  const { data: fallbackData, error: fallbackError } = await supabase.storage
    .from('recordings')
    .createSignedUrl(fallbackFileName, 60 * 60);

  if (fallbackData?.signedUrl) {
    return fallbackData.signedUrl;
  }

  console.error('Error getting audio URL:', error || fallbackError);
  throw new Error('Failed to get signed URL - file not found');
}

/**
 * Delete audio file from storage
 * Tries to delete both possible extensions to ensure cleanup
 */
export async function deleteAudio(userId: string, recordingId: string): Promise<void> {
  // Try to delete both possible extensions
  const fileNames = [
    `${userId}/${recordingId}.m4a`,
    `${userId}/${recordingId}.webm`,
  ];

  const { error } = await supabase.storage
    .from('recordings')
    .remove(fileNames);

  if (error) {
    console.error('Error deleting audio:', error);
    // Don't throw - allow deletion to continue even if storage fails
  }
}

/**
 * Upload audio as a single file (no client-side chunking)
 *
 * Client-side chunking was removed because byte-level splitting of container
 * formats (M4A/MP4/WebM) corrupts the audio files - subsequent chunks lack
 * valid headers and produce garbage transcriptions.
 *
 * Instead, the server now handles large files:
 * - Files ≤25MB: Transcribed via Groq Whisper
 * - Files >25MB: Transcribed via Google Cloud STT (async)
 *
 * Accepts Blob (web) or base64 string (React Native)
 * Returns array with single chunk for backwards compatibility
 */
export async function uploadAudioChunked(
  userId: string,
  recordingId: string,
  audioData: Blob | string, // Blob for web, base64 string for native
  durationSeconds: number,
  onProgress?: (current: number, total: number) => void
): Promise<{
  chunks: Array<{ url: string; startTime: number; endTime: number; index: number }>;
  needsChunking: boolean;
}> {
  const sizeInfo = typeof audioData === 'string'
    ? `${(audioData.length / 1024 / 1024).toFixed(2)}MB base64`
    : `${(audioData.size / 1024 / 1024).toFixed(2)}MB`;

  console.log(`[uploadAudioChunked] Uploading single file: ${sizeInfo}`);

  const url = await uploadAudio(userId, recordingId, audioData);
  onProgress?.(1, 1);

  return {
    chunks: [{ url, startTime: 0, endTime: durationSeconds, index: 0 }],
    needsChunking: false,
  };
}

/**
 * Delete all chunks for a recording
 * Tries to delete both possible extensions to ensure cleanup
 */
export async function deleteAudioChunks(userId: string, recordingId: string, chunkCount: number): Promise<void> {
  const fileNames: string[] = [];

  // Add main files (both extensions)
  fileNames.push(`${userId}/${recordingId}.m4a`);
  fileNames.push(`${userId}/${recordingId}.webm`);

  // Add chunk files (both extensions)
  for (let i = 0; i < chunkCount; i++) {
    fileNames.push(`${userId}/${recordingId}_chunk${i}.m4a`);
    fileNames.push(`${userId}/${recordingId}_chunk${i}.webm`);
  }

  const { error } = await supabase.storage
    .from('recordings')
    .remove(fileNames);

  if (error) {
    console.error('Error deleting audio chunks:', error);
  }
}

// ============================================
// Processing
// ============================================

/**
 * Process a recording (transcription + summarization)
 * Supports chunked audio - pass array of chunk info for long recordings
 */
export async function processRecording(
  recordingId: string,
  userId: string,
  audioChunks: Array<{ url: string; startTime: number; endTime: number; index: number }>,
  language: string,
  durationSeconds: number,
  forceGoogleSTT: boolean = false // For testing: force Google STT regardless of file size
): Promise<{
  success: boolean;
  error?: string;
  step?: string;
  usage?: { minutes_used: number; minutes_limit: number };
}> {
  console.log('[API] processRecording called:', {
    recordingId,
    userId,
    audioChunksCount: audioChunks.length,
    language,
    durationSeconds,
    forceGoogleSTT
  });

  try {
    const { data, error } = await supabase.functions.invoke('process-recording', {
      body: {
        recording_id: recordingId,
        user_id: userId,
        audio_chunks: audioChunks,
        language,
        duration_seconds: durationSeconds,
        force_google_stt: forceGoogleSTT,
      },
    });

    if (error) {
      console.error('Error processing recording:', error);

      // Try to extract error context from FunctionsHttpError
      // The error.context property contains the Response object
      let errorDetails: { message?: string; step?: string; error?: string } | null = null;
      try {
        // Type guard for FunctionsHttpError with context
        if (
          error &&
          typeof error === 'object' &&
          'context' in error &&
          error.context &&
          typeof error.context === 'object' &&
          'json' in error.context &&
          typeof error.context.json === 'function'
        ) {
          errorDetails = await error.context.json();
          console.error('Error response body:', errorDetails);
        }
      } catch (parseErr) {
        console.error('Could not parse error response:', parseErr);
      }

      // Safely extract error message with type validation
      const errorMsg = (
        (typeof errorDetails?.message === 'string' ? errorDetails.message : null) ||
        (typeof errorDetails?.error === 'string' ? errorDetails.error : null) ||
        (typeof error?.message === 'string' ? error.message : null) ||
        'Processing failed'
      );
      const errorStep = typeof errorDetails?.step === 'string' ? errorDetails.step : undefined;
      console.error('Error details:', { errorMsg, errorStep, data });
      return { success: false, error: errorMsg, step: errorStep };
    }

    if (data?.error) {
      console.error('Processing returned error:', data.error, data.message);
      const dataErrorMsg = (
        (typeof data.message === 'string' ? data.message : null) ||
        (typeof data.error === 'string' ? data.error : null) ||
        'Processing failed'
      );
      return { success: false, error: dataErrorMsg, step: data.step, usage: data.usage };
    }

    return { success: true, usage: data?.usage };
  } catch (err) {
    console.error('Exception in processRecording:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Summarize an existing recording that has notes but no summary
 * This is a free operation (doesn't consume AI minutes)
 */
export async function summarizeRecording(
  recordingId: string,
  userId: string,
  language: string
): Promise<{
  success: boolean;
  error?: string;
  summaryPoints?: number;
}> {
  console.log('[API] summarizeRecording called:', { recordingId, userId, language });

  try {
    const { data, error } = await supabase.functions.invoke('summarize-recording', {
      body: {
        recording_id: recordingId,
        user_id: userId,
        language,
      },
    });

    if (error) {
      console.error('Error summarizing recording:', error);
      return { success: false, error: error.message || 'Summarization failed' };
    }

    if (data?.error) {
      console.error('Summarization returned error:', data.error, data.message);
      return { success: false, error: data.message || data.error };
    }

    return { success: true, summaryPoints: data?.summary_points };
  } catch (err) {
    console.error('Exception in summarizeRecording:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================
// Recordings Database
// ============================================

/**
 * Save recording to database
 */
export async function saveRecording(recording: {
  id: string;
  user_id: string;
  device_id: string;
  duration: number;
  audio_url: string;
  status: string;
  language: string;
  label?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('recordings')
    .insert(recording);

  if (error) {
    console.error('Error saving recording:', error);
    throw error;
  }
}

/**
 * Update recording in database
 */
export async function updateRecordingInDb(
  recordingId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('recordings')
    .update(updates)
    .eq('id', recordingId);

  if (error) {
    console.error('Error updating recording:', error);
    throw error;
  }
}

/**
 * Soft delete recording from database (marks as deleted but keeps data for admin visibility)
 */
export async function deleteRecordingFromDb(recordingId: string): Promise<void> {
  const { error } = await supabase
    .from('recordings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', recordingId);

  if (error) {
    console.error('Error soft-deleting recording:', error);
    throw error;
  }
}

/**
 * Hard delete recording from database (complete erasure - GDPR compliant)
 * This permanently removes all data including transcripts and summaries
 */
export async function hardDeleteRecordingFromDb(recordingId: string): Promise<void> {
  const { error } = await supabase
    .from('recordings')
    .delete()
    .eq('id', recordingId);

  if (error) {
    console.error('Error hard-deleting recording:', error);
    throw error;
  }
}

/**
 * Fetch recordings from database (excludes soft-deleted recordings)
 */
export async function fetchRecordings(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)  // Exclude soft-deleted recordings
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recordings:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch a single recording by ID
 */
export async function fetchRecordingById(recordingId: string): Promise<{
  id: string;
  status: string;
  notes: unknown[] | null;
  summary: unknown[] | null;
  audio_url: string | null;
  label: string | null;
  created_at: string;
  duration: number;
} | null> {
  const { data, error } = await supabase
    .from('recordings')
    .select('id, status, notes, summary, audio_url, label, created_at, duration')
    .eq('id', recordingId)
    .single();

  if (error) {
    console.error('Error fetching recording:', error);
    return null;
  }

  return data;
}

/**
 * Subscribe to recording updates (real-time)
 */
export function subscribeToRecording(
  recordingId: string,
  callback: (recording: unknown) => void
) {
  return supabase
    .channel(`recording:${recordingId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'recordings',
        filter: `id=eq.${recordingId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();
}

// =============================================
// Admin Functions
// =============================================

export interface UsageHistoryItem {
  period_start: string;
  period_type: string;
  minutes_recorded: number;
  minutes_transcribed: number;
  recording_count: number;
}

export interface AdminRecordingItem {
  id: string;
  created_at: string;
  duration: number;
  status: string;
  deleted_at: string | null;
  is_deleted: boolean;
  transcription_seconds: number | null;
  summary_seconds: number | null;
}

export interface AdminRecordingsResponse {
  recordings: AdminRecordingItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface AdminUserInfo {
  id: string;
  device_id: string;
  tier: string;
  support_code: string;
  created_at: string;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  usage_history: UsageHistoryItem[];
  total_recordings: number;
  deleted_recordings: number;
}

/**
 * Look up a user by their support code (admin function)
 * Uses supabaseAdmin client since admin has separate auth
 */
export async function lookupUserBySupportCode(supportCode: string): Promise<AdminUserInfo | null> {
  console.log('[Admin] Looking up user with code:', supportCode.toUpperCase());

  // Check if admin is authenticated
  const { data: { session } } = await supabaseAdmin.auth.getSession();
  console.log('[Admin] Admin session exists:', !!session);
  console.log('[Admin] Admin user:', session?.user?.email);

  const { data, error } = await supabaseAdmin.rpc('lookup_user_by_support_code', {
    p_support_code: supportCode.toUpperCase(),
  });

  console.log('[Admin] RPC response - data:', data, 'error:', error);

  if (error) {
    console.error('[Admin] Error looking up user:', error);
    throw error;
  }

  // Function now returns JSON directly (or null if not found)
  if (!data) {
    console.log('[Admin] No user found with code:', supportCode);
    return null;
  }

  console.log('[Admin] Found user:', data);
  return data as AdminUserInfo;
}

/**
 * Set a user's tier (admin function)
 * Uses supabaseAdmin client since admin has separate auth
 */
export async function adminSetUserTier(
  supportCode: string,
  tier: 'free' | 'premium' | 'vip',
  adminKey: string
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabaseAdmin.rpc('admin_set_user_tier', {
    p_support_code: supportCode.toUpperCase(),
    p_tier: tier,
    p_admin_key: adminKey,
  });

  if (error) {
    console.error('Error setting user tier:', error);
    return { success: false, message: error.message };
  }

  return data as { success: boolean; message: string };
}

/**
 * Get user tier history (admin function)
 * Returns audit log of all tier changes for a user
 */
export interface TierHistoryEntry {
  id: string;
  previous_tier: string | null;
  new_tier: string;
  changed_by: string;
  reason: string | null;
  created_at: string;
}

export async function adminGetUserTierHistory(
  deviceId: string,
  adminKey: string
): Promise<TierHistoryEntry[]> {
  const { data, error } = await supabaseAdmin.rpc('admin_get_user_tier_history', {
    p_device_id: deviceId,
    p_admin_key: adminKey,
  });

  if (error) {
    console.error('Error fetching tier history:', error);
    return [];
  }

  return (data || []) as TierHistoryEntry[];
}

/**
 * Get paginated recordings for a user (admin function)
 * Includes processing times for transcription and summary generation
 */
export async function adminGetUserRecordings(
  userId: string,
  page: number = 1,
  perPage: number = 20
): Promise<AdminRecordingsResponse> {
  const { data, error } = await supabaseAdmin.rpc('admin_get_user_recordings', {
    p_user_id: userId,
    p_page: page,
    p_per_page: perPage,
  });

  if (error) {
    console.error('Error fetching user recordings:', error);
    throw error;
  }

  return data as AdminRecordingsResponse;
}
