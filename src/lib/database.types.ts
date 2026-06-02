export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      event_attachments: {
        Row: {
          created_at: string;
          created_by: string;
          data: Json;
          event_id: string;
          id: string;
          kind: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          data?: Json;
          event_id: string;
          id?: string;
          kind: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          data?: Json;
          event_id?: string;
          id?: string;
          kind?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          all_day: boolean;
          created_at: string;
          created_by: string;
          description: string | null;
          ends_at: string | null;
          family_id: string;
          id: string;
          location: string | null;
          starts_at: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          all_day?: boolean;
          created_at?: string;
          created_by: string;
          description?: string | null;
          ends_at?: string | null;
          family_id: string;
          id?: string;
          location?: string | null;
          starts_at: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          all_day?: boolean;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          ends_at?: string | null;
          family_id?: string;
          id?: string;
          location?: string | null;
          starts_at?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      families: {
        Row: {
          avatar_path: string | null;
          created_at: string;
          created_by: string;
          id: string;
          invite_code: string;
          name: string;
        };
        Insert: {
          avatar_path?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          invite_code: string;
          name: string;
        };
        Update: {
          avatar_path?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          invite_code?: string;
          name?: string;
        };
        Relationships: [];
      };
      family_members: {
        Row: {
          family_id: string;
          joined_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          family_id: string;
          joined_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          family_id?: string;
          joined_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
        };
        Insert: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
        };
        Update: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      event_participants: {
        Row: {
          added_at: string;
          added_by: string;
          event_id: string;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          added_by: string;
          event_id: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string;
          event_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_family: {
        Args: { p_name: string };
        Returns: {
          created_at: string;
          created_by: string;
          id: string;
          invite_code: string;
          name: string;
        };
      };
      join_family_by_code: {
        Args: { p_code: string };
        Returns: {
          created_at: string;
          created_by: string;
          id: string;
          invite_code: string;
          name: string;
        };
      };
      kick_family_member: {
        Args: { p_family: string; p_user: string };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Family = Database['public']['Tables']['families']['Row'];
export type FamilyMember = Database['public']['Tables']['family_members']['Row'];
export type EventRow = Database['public']['Tables']['events']['Row'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type EventUpdate = Database['public']['Tables']['events']['Update'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
