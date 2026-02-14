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
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          company: string | null;
          title: string | null;
          avatar_url: string | null;
          saved_signature_url: string | null;
          signature_type: string | null;
          plan: string;
          monthly_sends_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          company?: string | null;
          title?: string | null;
          avatar_url?: string | null;
          saved_signature_url?: string | null;
          signature_type?: string | null;
          plan?: string;
          monthly_sends_used?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          company?: string | null;
          title?: string | null;
          avatar_url?: string | null;
          saved_signature_url?: string | null;
          signature_type?: string | null;
          plan?: string;
          monthly_sends_used?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          status: string;
          file_path: string;
          signed_file_path: string | null;
          ai_summary: string | null;
          ai_fields: Json | null;
          expires_at: string | null;
          completed_at: string | null;
          message_to_signers: string | null;
          signing_order: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          status?: string;
          file_path: string;
          signed_file_path?: string | null;
          ai_summary?: string | null;
          ai_fields?: Json | null;
          expires_at?: string | null;
          completed_at?: string | null;
          message_to_signers?: string | null;
          signing_order?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          status?: string;
          file_path?: string;
          signed_file_path?: string | null;
          ai_summary?: string | null;
          ai_fields?: Json | null;
          expires_at?: string | null;
          completed_at?: string | null;
          message_to_signers?: string | null;
          signing_order?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      signers: {
        Row: {
          id: string;
          document_id: string;
          email: string;
          name: string;
          role: string;
          status: string;
          order_index: number;
          access_token: string;
          signed_at: string | null;
          viewed_at: string | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          email: string;
          name: string;
          role?: string;
          status?: string;
          order_index?: number;
          access_token?: string;
          signed_at?: string | null;
          viewed_at?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          email?: string;
          name?: string;
          role?: string;
          status?: string;
          order_index?: number;
          access_token?: string;
          signed_at?: string | null;
          viewed_at?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signers_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      fields: {
        Row: {
          id: string;
          document_id: string;
          signer_id: string;
          type: string;
          page: number;
          x: number;
          y: number;
          width: number;
          height: number;
          value: string | null;
          is_required: boolean;
          ai_suggested: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          signer_id: string;
          type: string;
          page: number;
          x: number;
          y: number;
          width: number;
          height: number;
          value?: string | null;
          is_required?: boolean;
          ai_suggested?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          signer_id?: string;
          type?: string;
          page?: number;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          value?: string | null;
          is_required?: boolean;
          ai_suggested?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fields_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fields_signer_id_fkey";
            columns: ["signer_id"];
            isOneToOne: false;
            referencedRelation: "signers";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          id: string;
          document_id: string;
          signer_id: string | null;
          actor_id: string | null;
          event_type: string;
          event_data: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          previous_hash: string | null;
          event_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          signer_id?: string | null;
          actor_id?: string | null;
          event_type: string;
          event_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          previous_hash?: string | null;
          event_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          signer_id?: string | null;
          actor_id?: string | null;
          event_type?: string;
          event_data?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          previous_hash?: string | null;
          event_hash?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_signer_id_fkey";
            columns: ["signer_id"];
            isOneToOne: false;
            referencedRelation: "signers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
