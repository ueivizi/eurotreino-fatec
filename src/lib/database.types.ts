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
      equipment: {
        Row: {
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          id: string
          label: string
          sort_order: number
        }
        Update: {
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      exercise_records: {
        Row: {
          achieved_at: string
          best_e1rm: number | null
          best_load_kg: number | null
          best_reps: number | null
          best_volume_kg: number | null
          exercise_id: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          best_e1rm?: number | null
          best_load_kg?: number | null
          best_reps?: number | null
          best_volume_kg?: number | null
          exercise_id: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          best_e1rm?: number | null
          best_load_kg?: number | null
          best_reps?: number | null
          best_volume_kg?: number | null
          exercise_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_records_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          equipment: string
          id: string
          is_active: boolean
          muscle_group: string
          name: string
          owner_id: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          equipment: string
          id: string
          is_active?: boolean
          muscle_group: string
          name: string
          owner_id?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          equipment?: string
          id?: string
          is_active?: boolean
          muscle_group?: string
          name?: string
          owner_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_equipment_fkey"
            columns: ["equipment"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_muscle_group_fkey"
            columns: ["muscle_group"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      honor: {
        Row: {
          exercise_id: string | null
          points: number
          updated_at: string
          user_id: string
          workout_type: string | null
        }
        Insert: {
          exercise_id?: string | null
          points?: number
          updated_at?: string
          user_id: string
          workout_type?: string | null
        }
        Update: {
          exercise_id?: string | null
          points?: number
          updated_at?: string
          user_id?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "honor_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honor_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honor_workout_type_fkey"
            columns: ["workout_type"]
            isOneToOne: false
            referencedRelation: "workout_types"
            referencedColumns: ["id"]
          },
        ]
      }
      honor_levels: {
        Row: {
          id: number
          min_points: number
          name: string
        }
        Insert: {
          id: number
          min_points: number
          name: string
        }
        Update: {
          id?: number
          min_points?: number
          name?: string
        }
        Relationships: []
      }
      muscle_groups: {
        Row: {
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          id: string
          label: string
          sort_order: number
        }
        Update: {
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          emblem: string
          emblem_color: string
          health_consent_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          emblem: string
          emblem_color?: string
          health_consent_at?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          emblem?: string
          emblem_color?: string
          health_consent_at?: string | null
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
      routine_exercises: {
        Row: {
          exercise_id: string
          position: number
          rest_seconds: number | null
          routine_id: string
          target_load_kg: number | null
          target_reps: number
          target_sets: number
        }
        Insert: {
          exercise_id: string
          position: number
          rest_seconds?: number | null
          routine_id: string
          target_load_kg?: number | null
          target_reps: number
          target_sets: number
        }
        Update: {
          exercise_id?: string
          position?: number
          rest_seconds?: number | null
          routine_id?: string
          target_load_kg?: number | null
          target_reps?: number
          target_sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "routine_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_exercises_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          exercise_id: string
          load_kg: number | null
          position: number
          reps: number
          workout_id: string
        }
        Insert: {
          exercise_id: string
          load_kg?: number | null
          position: number
          reps: number
          workout_id: string
        }
        Update: {
          exercise_id?: string
          load_kg?: number | null
          position?: number
          reps?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_types: {
        Row: {
          id: string
          is_active: boolean
          label: string
          module: string
          sort_order: number
        }
        Insert: {
          id: string
          is_active?: boolean
          label: string
          module?: string
          sort_order: number
        }
        Update: {
          id?: string
          is_active?: boolean
          label?: string
          module?: string
          sort_order?: number
        }
        Relationships: []
      }
      workouts: {
        Row: {
          avg_heart_rate: number | null
          bonus_points: number
          client_request_id: string
          distance_m: number | null
          duration_min: number
          duration_points: number
          id: string
          intensity: string
          intensity_points: number
          is_scored: boolean
          load_kg: number | null
          local_date: string
          logged_at: string
          max_heart_rate: number | null
          note: string | null
          performed_at: string
          points: number | null
          presence_points: number
          scoring_version: number
          sets_count: number | null
          user_id: string
          week_start: string
          workout_type: string
        }
        Insert: {
          avg_heart_rate?: number | null
          bonus_points: number
          client_request_id: string
          distance_m?: number | null
          duration_min: number
          duration_points: number
          id?: string
          intensity: string
          intensity_points: number
          is_scored: boolean
          load_kg?: number | null
          local_date: string
          logged_at?: string
          max_heart_rate?: number | null
          note?: string | null
          performed_at: string
          points?: number | null
          presence_points: number
          scoring_version: number
          sets_count?: number | null
          user_id: string
          week_start: string
          workout_type: string
        }
        Update: {
          avg_heart_rate?: number | null
          bonus_points?: number
          client_request_id?: string
          distance_m?: number | null
          duration_min?: number
          duration_points?: number
          id?: string
          intensity?: string
          intensity_points?: number
          is_scored?: boolean
          load_kg?: number | null
          local_date?: string
          logged_at?: string
          max_heart_rate?: number | null
          note?: string | null
          performed_at?: string
          points?: number | null
          presence_points?: number
          scoring_version?: number
          sets_count?: number | null
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
        Args: {
          p_display_name: string
          p_emblem: string
          p_emblem_color?: string
        }
        Returns: {
          created_at: string
          display_name: string
          emblem: string
          emblem_color: string
          health_consent_at: string | null
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
      create_exercise: {
        Args: { p_equipment: string; p_muscle_group: string; p_name: string }
        Returns: {
          created_at: string
          equipment: string
          id: string
          is_active: boolean
          muscle_group: string
          name: string
          owner_id: string | null
          sort_order: number | null
        }
        SetofOptions: {
          from: "*"
          to: "exercises"
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
      delete_routine: { Args: { p_routine_id: string }; Returns: boolean }
      edit_workout: {
        Args: {
          p_avg_heart_rate?: number
          p_distance_m?: number
          p_duration_min: number
          p_intensity: string
          p_load_kg?: number
          p_note?: string
          p_sets_count?: number
          p_workout_id: string
          p_workout_type: string
        }
        Returns: {
          is_scored: boolean
          points: number
          total_glory: number
          week_glory: number
          workout_id: string
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
          emblem_color: string
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
      log_strength_workout: {
        Args: {
          p_client_request_id: string
          p_duration_min: number
          p_intensity: string
          p_performed_at?: string
          p_routine_id?: string
          p_sets: Json
          p_workout_type: string
        }
        Returns: Json
      }
      log_workout: {
        Args: {
          p_avg_heart_rate?: number
          p_client_request_id: string
          p_distance_m?: number
          p_duration_min: number
          p_intensity: string
          p_load_kg?: number
          p_max_heart_rate?: number
          p_note?: string
          p_performed_at?: string
          p_sets_count?: number
          p_workout_type: string
        }
        Returns: {
          bonus_points: number
          duration_points: number
          intensity_points: number
          is_distance_record: boolean
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
      my_honor: {
        Args: never
        Returns: {
          best_e1rm: number
          best_load_kg: number
          best_reps: number
          exercise_id: string
          exercise_name: string
          level_id: number
          level_name: string
          next_level_points: number
          points: number
          workout_type: string
        }[]
      }
      my_progress: {
        Args: never
        Returns: {
          last_distance_m: number
          last_duration_min: number
          last_intensity: string
          last_load_kg: number
          last_note: string
          last_sets_count: number
          last_workout_type: string
          total_glory: number
          total_workouts: number
          week_glory: number
          week_scored_workouts: number
          week_start: string
        }[]
      }
      my_records: {
        Args: never
        Returns: {
          best_distance_m: number
          best_load_kg: number
          best_pace_s_per_km: number
          best_sets_count: number
          module: string
          total_distance_m: number
          total_minutes: number
          workout_type: string
          workouts_count: number
        }[]
      }
      my_workout_months: {
        Args: never
        Returns: {
          glory: number
          month: string
          workouts_count: number
        }[]
      }
      my_workouts: {
        Args: { p_month?: string }
        Returns: {
          avg_heart_rate: number
          bonus_points: number
          can_edit: boolean
          distance_m: number
          duration_min: number
          duration_points: number
          intensity: string
          intensity_points: number
          is_scored: boolean
          load_kg: number
          local_date: string
          module: string
          note: string
          performed_at: string
          points: number
          presence_points: number
          sets_count: number
          workout_id: string
          workout_type: string
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
      save_routine: {
        Args: { p_items: Json; p_name: string; p_routine_id: string }
        Returns: {
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "routines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_health_consent: { Args: { p_granted: boolean }; Returns: string }
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
