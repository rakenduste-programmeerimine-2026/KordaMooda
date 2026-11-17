// Andmebaasi tüübid. Ära muuda käsitsi: genereeri uuesti käsuga `npm run db:types`.
//
// NB: see versioon on kirjutatud käsitsi migratsiooni 20261117175516_initial_schema.sql
// põhjal (#5), sest Docker ega `supabase login` polnud saadaval. Kirjuta see esimesel
// võimalusel genereeritud versiooniga üle.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      chores: {
        Row: {
          created_at: string;
          current_member_id: string;
          household_id: string;
          id: string;
          last_done_at: string | null;
          last_member_id: string | null;
          name: string;
        };
        Insert: {
          created_at?: string;
          current_member_id: string;
          household_id: string;
          id?: string;
          last_done_at?: string | null;
          last_member_id?: string | null;
          name: string;
        };
        Update: {
          created_at?: string;
          current_member_id?: string;
          household_id?: string;
          id?: string;
          last_done_at?: string | null;
          last_member_id?: string | null;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chores_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chores_household_id_current_member_id_fkey";
            columns: ["household_id", "current_member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["household_id", "id"];
          },
          {
            foreignKeyName: "chores_household_id_last_member_id_fkey";
            columns: ["household_id", "last_member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["household_id", "id"];
          },
        ];
      };
      household_users: {
        Row: {
          created_at: string;
          household_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_users_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          id: string;
          invite_code: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invite_code?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invite_code?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          created_at: string;
          household_id: string;
          id: string;
          name: string;
          position: number;
        };
        Insert: {
          created_at?: string;
          household_id: string;
          id?: string;
          name: string;
          position: number;
        };
        Update: {
          created_at?: string;
          household_id?: string;
          id?: string;
          name?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_invite_code: { Args: never; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

/** Row type of a table, e.g. `Tables<"chores">`. */
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
