import { supabase, isSupabaseConfigured } from './supabase';
import { Recording, NoteLine } from '@/types';
import { Language } from '@/i18n/translations';
import { File as ExpoFile } from 'expo-file-system';
import { decode } from 'base-64';
import { RecordingStatus, Json } from '@/types/database';

// Upload audio file to Supabase Storage
export async function uploadAudioFile(
  localUri: string,
  recordingId: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, skipping upload');
    return null;
  }

  try {
    // Use the new expo-file-system File class
    const file = new ExpoFile(localUri);
    if (!file.exists) {
      throw new Error('Audio file does not exist');
    }

    // Read file as base64 and convert to ArrayBuffer for Supabase
    const base64 = await file.base64();
    const binaryString = decode(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    // Upload to Supabase Storage
    const filePath = `${recordingId}.m4a`;
    const { data, error } = await supabase.storage
      .from('recordings')
      .upload(filePath, arrayBuffer, {
        contentType: 'audio/mp4',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('recordings')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Failed to upload audio:', error);
    return null;
  }
}

// Create a recording in Supabase
export async function createRecordingInSupabase(
  recording: Recording,
  deviceId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.log('Supabase not configured, skipping create');
    return false;
  }

  try {
    const { error } = await supabase.from('recordings').insert({
      id: recording.id,
      device_id: deviceId,
      duration: recording.duration,
      audio_url: recording.audioRemoteUrl || recording.audioUri,
      status: recording.status,
      language: recording.language,
    });

    if (error) {
      throw error;
    }

    // Add to processing queue
    await supabase.from('processing_queue').insert({
      recording_id: recording.id,
      step: 'transcription',
      status: 'pending',
    });

    return true;
  } catch (error) {
    console.error('Failed to create recording in Supabase:', error);
    return false;
  }
}

// Update recording with notes/summary
export async function updateRecordingInSupabase(
  recordingId: string,
  updates: {
    status?: string;
    notes?: NoteLine[];
    summary?: string[];
    errorMessage?: string;
  }
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('recordings')
      .update({
        status: updates.status as RecordingStatus | undefined,
        notes: updates.notes as Json | undefined,
        summary: updates.summary as Json | undefined,
        error_message: updates.errorMessage,
      })
      .eq('id', recordingId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to update recording:', error);
    return false;
  }
}

// Trigger transcription via Edge Function
export async function triggerTranscription(
  recordingId: string,
  audioUrl: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke('transcribe', {
      body: { recordingId, audioUrl },
    });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to trigger transcription:', error);
    return false;
  }
}

// Trigger summarization via Edge Function
export async function triggerSummarization(
  recordingId: string,
  notes: NoteLine[]
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke('summarize', {
      body: { recordingId, notes },
    });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Failed to trigger summarization:', error);
    return false;
  }
}

// Poll for recording status updates
export async function pollRecordingStatus(
  recordingId: string
): Promise<Recording | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (error) {
      throw error;
    }

    // Runtime type validation for database response
    if (!data) {
      throw new Error('No data returned from database');
    }

    // Validate required fields
    if (typeof data.id !== 'string' || !data.id) {
      throw new Error('Invalid or missing id in database response');
    }
    if (typeof data.created_at !== 'string' || !data.created_at) {
      throw new Error('Invalid or missing created_at in database response');
    }
    if (typeof data.duration !== 'number') {
      throw new Error('Invalid or missing duration in database response');
    }
    if (typeof data.audio_url !== 'string' || !data.audio_url) {
      throw new Error('Invalid or missing audio_url in database response');
    }
    if (typeof data.status !== 'string' || !data.status) {
      throw new Error('Invalid or missing status in database response');
    }
    if (typeof data.language !== 'string' || !data.language) {
      throw new Error('Invalid or missing language in database response');
    }

    // Validate optional fields when present
    if (data.notes !== null && data.notes !== undefined && !Array.isArray(data.notes)) {
      console.warn('Invalid notes type in database response, expected array:', typeof data.notes);
      data.notes = null; // Sanitize invalid data
    }
    if (data.summary !== null && data.summary !== undefined && !Array.isArray(data.summary)) {
      console.warn('Invalid summary type in database response, expected array:', typeof data.summary);
      data.summary = null; // Sanitize invalid data
    }
    if (data.error_message !== null && data.error_message !== undefined && typeof data.error_message !== 'string') {
      console.warn('Invalid error_message type in database response, expected string:', typeof data.error_message);
      data.error_message = null; // Sanitize invalid data
    }

    return {
      id: data.id,
      createdAt: data.created_at,
      duration: data.duration,
      audioUri: data.audio_url,
      audioRemoteUrl: data.audio_url,
      status: data.status,
      // Type casts needed: database stores as Json, we validate structure above
      notes: (data.notes as unknown) as NoteLine[] | undefined,
      summary: (data.summary as unknown) as string[] | undefined,
      language: (data.language as Language) || undefined,
      errorMessage: data.error_message ?? undefined,
    };
  } catch (error) {
    console.error('Failed to poll recording status:', error);
    return null;
  }
}
