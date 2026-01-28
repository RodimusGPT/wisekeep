export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Status type for recordings - shared between types
export type RecordingStatus = 'recording' | 'recorded' | 'uploading' | 'processing_notes' | 'notes_ready' | 'processing_summary' | 'ready' | 'error';

export type Database = {
  public: {
    Tables: {
      recordings: {
        Row: {
          id: string;
          created_at: string;
          duration: number;
          audio_url: string;
          status: RecordingStatus;
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
          status?: RecordingStatus;
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
          status?: RecordingStatus;
          notes?: Json | null;
          summary?: Json | null;
          language?: string | null;
          error_message?: string | null;
          device_id?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Helper type for table row access
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
