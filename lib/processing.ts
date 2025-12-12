import { supabase, isSupabaseConfigured } from './supabase';
import { Recording, NoteLine } from '@/types';
import * as FileSystem from 'expo-file-system';

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
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file does not exist');
    }

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert to Blob
    const response = await fetch(`data:audio/m4a;base64,${base64}`);
    const blob = await response.blob();

    // Upload to Supabase Storage
    const filePath = `${recordingId}.m4a`;
    const { data, error } = await supabase.storage
      .from('recordings')
      .upload(filePath, blob, {
        contentType: 'audio/m4a',
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
        status: updates.status,
        notes: updates.notes,
        summary: updates.summary,
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

    return {
      id: data.id,
      createdAt: data.created_at,
      duration: data.duration,
      audioUri: data.audio_url,
      audioRemoteUrl: data.audio_url,
      status: data.status,
      notes: data.notes,
      summary: data.summary,
      language: data.language,
      errorMessage: data.error_message,
    };
  } catch (error) {
    console.error('Failed to poll recording status:', error);
    return null;
  }
}
