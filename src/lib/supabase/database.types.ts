
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "chores": {
                  Row: {
                    "created_at": string,"current_member_id": string,"household_id": string,"id": string,"last_done_at": string | null,"last_done_by": string | null,"last_member_id": string | null,"name": string,"prev_last_done_at": string | null,"prev_last_member_id": string | null,"removed_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_member_id": string,"household_id": string,"id"?: string,"last_done_at"?: string | null,"last_done_by"?: string | null,"last_member_id"?: string | null,"name": string,"prev_last_done_at"?: string | null,"prev_last_member_id"?: string | null,"removed_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"current_member_id"?: string,"household_id"?: string,"id"?: string,"last_done_at"?: string | null,"last_done_by"?: string | null,"last_member_id"?: string | null,"name"?: string,"prev_last_done_at"?: string | null,"prev_last_member_id"?: string | null,"removed_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chores_household_id_current_member_id_fkey"
      columns: ["household_id","current_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["household_id","id"]
    },{
      foreignKeyName: "chores_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chores_household_id_last_member_id_fkey"
      columns: ["household_id","last_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["household_id","id"]
    },{
      foreignKeyName: "chores_household_id_prev_last_member_id_fkey"
      columns: ["household_id","prev_last_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["household_id","id"]
    }
                  ]
                },"household_users": {
                  Row: {
                    "created_at": string,"household_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "household_users_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "abandoned_at": string | null,"changed_at": string,"created_at": string,"id": string,"invite_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abandoned_at"?: string | null,"changed_at"?: string,"created_at"?: string,"id"?: string,"invite_code"?: string
                  }
                  Update: {
                    "abandoned_at"?: string | null,"changed_at"?: string,"created_at"?: string,"id"?: string,"invite_code"?: string
                  }
                  Relationships: [
                    
                  ]
                },"members": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"name": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"id"?: string,"name": string,"position": number
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"name"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_household":
{ Args: { "member_names": (string)[] }; Returns: string
                           },
"generate_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"join_household":
{ Args: { "code": string }; Returns: string
                           },
"mark_done":
{ Args: { "chore_id": string,"expected_member_id": string }; Returns: string
                           },
"new_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"remove_chore":
{ Args: { "chore_id": string }; Returns: string
                           },
"restore_chore":
{ Args: { "chore_id": string }; Returns: string
                           },
"undo_done":
{ Args: { "chore_id": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
