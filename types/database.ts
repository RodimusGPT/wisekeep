export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      recordings: {
        Row: {
          id: string;
          created_at: string;
          duration: number;
          audio_url: string;
          status: 'recorded' | 'processing_notes' | 'processing_summary' | 'ready' | 'error';
          notes: Json | null;
          summary: Json | null;
          language: string | null;
          error_message: string | null;
          device_id: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          duration: number;
          audio_url: string;
          status?: 'recorded' | 'processing_notes' | 'processing_summary' | 'ready' | 'error';
          notes?: Json | null;
          summary?: Json | null;
          language?: string | null;
          error_message?: string | null;
          device_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          duration?: number;
          audio_url?: string;
          status?: 'recorded' | 'processing_notes' | 'processing_summary' | 'ready' | 'error';
          notes?: Json | null;
          summary?: Json | null;
          language?: string | null;
          error_message?: string | null;
          device_id?: string;
        };
      };
      processing_queue: {
        Row: {
          id: string;
          recording_id: string;
          created_at: string;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          step: 'transcription' | 'summarization';
          error_message: string | null;
        };
        Insert: {
          id?: string;
          recording_id: string;
          created_at?: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          step: 'transcription' | 'summarization';
          error_message?: string | null;
        };
        Update: {
          id?: string;
          recording_id?: string;
          created_at?: string;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          step?: 'transcription' | 'summarization';
          error_message?: string | null;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
