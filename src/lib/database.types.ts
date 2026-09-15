export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          emblem: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          emblem: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          emblem?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          emblem: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          emblem: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          emblem?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rank_tiers: {
        Row: {
          division: number | null
          id: number
          min_glory: number
          tier: number
          tier_name: string
        }
        Insert: {
          division?: number | null
          id: number
          min_glory: number
          tier: number
          tier_name: string
        }
        Update: {
          division?: number | null
          id?: number
          min_glory?: number
          tier?: number
          tier_name?: string
        }
        Relationships: []
      }
      workout_types: {
        Row: {
          id: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          id: string
          is_active?: boolean
          label: string
          sort_order: number
        }
        Update: {
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      workouts: {
        Row: {
          bonus_points: number
          client_request_id: string
          duration_min: number
          duration_points: number
          id: string
          intensity: string
          intensity_points: number
          is_scored: boolean
          local_date: string
          logged_at: string
          performed_at: string
          points: number | null
          presence_points: number
          scoring_version: number
          user_id: string
          week_start: string
          workout_type: string
        }
        Insert: {
          bonus_points: number
          client_request_id: string
          duration_min: number
          duration_points: number
          id?: string
          intensity: string
          intensity_points: number
          is_scored: boolean
          local_date: string
          logged_at?: string
          performed_at: string
          points?: number | null
          presence_points: number
          scoring_version: number
          user_id: string
          week_start: string
          workout_type: string
        }
        Update: {
          bonus_points?: number
          client_request_id?: string
          duration_min?: number
          duration_points?: number
          id?: string
          intensity?: string
          intensity_points?: number
          is_scored?: boolean
          local_date?: string
          logged_at?: string
          performed_at?: string
          points?: number | null
          presence_points?: number
          scoring_version?: number
          user_id?: string
          week_start?: string
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_workout_type_fkey"
            columns: ["workout_type"]
            isOneToOne: false
            referencedRelation: "workout_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_profile: {
        Args: { p_display_name: string; p_emblem: string }
        Returns: {
          created_at: string
          display_name: string
          emblem: string
          id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_group: {
        Args: { p_emblem: string; p_name: string }
        Returns: {
          emblem: string
          group_id: string
          invite_code: string
          invite_expires_at: string
          name: string
        }[]
      }
      get_group_invite: {
        Args: { p_group_id: string }
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      group_weekly_ranking: {
        Args: { p_group_id: string; p_week_offset?: number }
        Returns: {
          display_name: string
          emblem: string
          is_me: boolean
          place: number
          role: string
          total_glory: number
          user_id: string
          week_glory: number
          week_start: string
        }[]
      }
      join_group_by_code: {
        Args: { p_code: string }
        Returns: {
          group_id: string
          group_name: string
          status: string
        }[]
      }
      leave_group: { Args: { p_group_id: string }; Returns: undefined }
      log_workout: {
        Args: {
          p_client_request_id: string
          p_duration_min: number
          p_intensity: string
          p_performed_at?: string
          p_workout_type: string
        }
        Returns: {
          bonus_points: number
          duration_points: number
          intensity_points: number
          is_scored: boolean
          points: number
          presence_points: number
          replayed: boolean
          total_glory: number
          week_glory: number
          workout_id: string
        }[]
      }
      my_groups: {
        Args: never
        Returns: {
          emblem: string
          group_id: string
          joined_at: string
          member_count: number
          name: string
          role: string
        }[]
      }
      my_progress: {
        Args: never
        Returns: {
          last_duration_min: number
          last_intensity: string
          last_workout_type: string
          total_glory: number
          total_workouts: number
          week_glory: number
          week_scored_workouts: number
          week_start: string
        }[]
      }
      preview_invite: {
        Args: { p_code: string }
        Returns: {
          group_emblem: string
          group_name: string
          is_member: boolean
          member_count: number
          status: string
        }[]
      }
      regenerate_invite: {
        Args: { p_group_id: string }
        Returns: {
          code: string
          expires_at: string
        }[]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
