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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          auto_refresh: boolean | null
          created_at: string
          id: string
          language: string | null
          refresh_interval: number | null
          theme: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_refresh?: boolean | null
          created_at?: string
          id?: string
          language?: string | null
          refresh_interval?: number | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_refresh?: boolean | null
          created_at?: string
          id?: string
          language?: string | null
          refresh_interval?: number | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      container_widgets: {
        Row: {
          container_id: string
          created_at: string
          id: string
          settings: Json | null
          slot_index: number | null
          updated_at: string
          widget_id: string
        }
        Insert: {
          container_id: string
          created_at?: string
          id?: string
          settings?: Json | null
          slot_index?: number | null
          updated_at?: string
          widget_id: string
        }
        Update: {
          container_id?: string
          created_at?: string
          id?: string
          settings?: Json | null
          slot_index?: number | null
          updated_at?: string
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "container_widgets_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "page_containers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "container_widgets_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          auto_refresh: boolean | null
          cache_ttl: number | null
          created_at: string | null
          description: string | null
          filters: Json | null
          id: string
          is_active: boolean | null
          is_shared: boolean | null
          last_fetched_at: string | null
          last_fields: Json | null
          last_record_count: number | null
          last_sample_data: Json | null
          limit_count: number | null
          method: string
          module: string
          name: string
          period_config: Json | null
          refresh_schedule: string | null
          selected_columns: string[] | null
          slug: string
          sorts: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_refresh?: boolean | null
          cache_ttl?: number | null
          created_at?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          is_shared?: boolean | null
          last_fetched_at?: string | null
          last_fields?: Json | null
          last_record_count?: number | null
          last_sample_data?: Json | null
          limit_count?: number | null
          method: string
          module: string
          name: string
          period_config?: Json | null
          refresh_schedule?: string | null
          selected_columns?: string[] | null
          slug: string
          sorts?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_refresh?: boolean | null
          cache_ttl?: number | null
          created_at?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          is_shared?: boolean | null
          last_fetched_at?: string | null
          last_fields?: Json | null
          last_record_count?: number | null
          last_sample_data?: Json | null
          limit_count?: number | null
          method?: string
          module?: string
          name?: string
          period_config?: Json | null
          refresh_schedule?: string | null
          selected_columns?: string[] | null
          slug?: string
          sorts?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      firma_branches: {
        Row: {
          branch_code: string
          branch_key: number
          branch_name: string | null
          created_at: string
          fetched_at: string | null
          firma_kodu: string
          id: string
          is_active: boolean | null
          sunucu_adi: string
          updated_at: string
        }
        Insert: {
          branch_code: string
          branch_key: number
          branch_name?: string | null
          created_at?: string
          fetched_at?: string | null
          firma_kodu: string
          id?: string
          is_active?: boolean | null
          sunucu_adi: string
          updated_at?: string
        }
        Update: {
          branch_code?: string
          branch_key?: number
          branch_name?: string | null
          created_at?: string
          fetched_at?: string | null
          firma_kodu?: string
          id?: string
          is_active?: boolean | null
          sunucu_adi?: string
          updated_at?: string
        }
        Relationships: []
      }
      firma_periods: {
        Row: {
          created_at: string
          end_date: string | null
          fetched_at: string | null
          firma_kodu: string
          id: string
          is_current: boolean | null
          period_name: string | null
          period_no: number
          start_date: string | null
          sunucu_adi: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          fetched_at?: string | null
          firma_kodu: string
          id?: string
          is_current?: boolean | null
          period_name?: string | null
          period_no: number
          start_date?: string | null
          sunucu_adi: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          fetched_at?: string | null
          firma_kodu?: string
          id?: string
          is_current?: boolean | null
          period_name?: string | null
          period_no?: number
          start_date?: string | null
          sunucu_adi?: string
          updated_at?: string
        }
        Relationships: []
      }
      firma_warehouses: {
        Row: {
          branch_key: number
          can_operate: boolean | null
          can_view_movement: boolean | null
          can_view_quantity: boolean | null
          created_at: string
          fetched_at: string | null
          firma_kodu: string
          id: string
          sunucu_adi: string
          updated_at: string
          warehouse_code: string
          warehouse_key: number
          warehouse_name: string | null
        }
        Insert: {
          branch_key: number
          can_operate?: boolean | null
          can_view_movement?: boolean | null
          can_view_quantity?: boolean | null
          created_at?: string
          fetched_at?: string | null
          firma_kodu: string
          id?: string
          sunucu_adi: string
          updated_at?: string
          warehouse_code: string
          warehouse_key: number
          warehouse_name?: string | null
        }
        Update: {
          branch_key?: number
          can_operate?: boolean | null
          can_view_movement?: boolean | null
          can_view_quantity?: boolean | null
          created_at?: string
          fetched_at?: string | null
          firma_kodu?: string
          id?: string
          sunucu_adi?: string
          updated_at?: string
          warehouse_code?: string
          warehouse_key?: number
          warehouse_name?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          category: string | null
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      page_containers: {
        Row: {
          container_type: Database["public"]["Enums"]["container_type"]
          created_at: string
          id: string
          page_id: string
          settings: Json | null
          sort_order: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          container_type: Database["public"]["Enums"]["container_type"]
          created_at?: string
          id?: string
          page_id: string
          settings?: Json | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          container_type?: Database["public"]["Enums"]["container_type"]
          created_at?: string
          id?: string
          page_id?: string
          settings?: Json | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_containers_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "user_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dia_api_key: string | null
          dia_session_expires: string | null
          dia_session_id: string | null
          dia_sunucu_adi: string | null
          dia_ws_kullanici: string | null
          dia_ws_sifre: string | null
          display_name: string | null
          donem_kodu: string | null
          donem_yili: string | null
          email: string | null
          firma_adi: string | null
          firma_kodu: string | null
          id: string
          is_demo_account: boolean | null
          is_team_admin: boolean | null
          updated_at: string
          use_mock_data: boolean | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dia_api_key?: string | null
          dia_session_expires?: string | null
          dia_session_id?: string | null
          dia_sunucu_adi?: string | null
          dia_ws_kullanici?: string | null
          dia_ws_sifre?: string | null
          display_name?: string | null
          donem_kodu?: string | null
          donem_yili?: string | null
          email?: string | null
          firma_adi?: string | null
          firma_kodu?: string | null
          id?: string
          is_demo_account?: boolean | null
          is_team_admin?: boolean | null
          updated_at?: string
          use_mock_data?: boolean | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dia_api_key?: string | null
          dia_session_expires?: string | null
          dia_session_id?: string | null
          dia_sunucu_adi?: string | null
          dia_ws_kullanici?: string | null
          dia_ws_sifre?: string | null
          display_name?: string | null
          donem_kodu?: string | null
          donem_yili?: string | null
          email?: string | null
          firma_adi?: string | null
          firma_kodu?: string | null
          id?: string
          is_demo_account?: boolean | null
          is_team_admin?: boolean | null
          updated_at?: string
          use_mock_data?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_dashboard_settings: {
        Row: {
          created_at: string | null
          id: string
          layout: Json
          page: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          layout?: Json
          page: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          layout?: Json
          page?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_pages: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          module: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_teams: {
        Row: {
          admin_id: string
          created_at: string | null
          id: string
          member_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          id?: string
          member_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          id?: string
          member_id?: string
        }
        Relationships: []
      }
      user_widget_filters: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          updated_at: string | null
          user_id: string
          widget_id: string
        }
        Insert: {
          created_at?: string | null
          filters?: Json
          id?: string
          updated_at?: string | null
          user_id: string
          widget_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          updated_at?: string | null
          user_id?: string
          widget_id?: string
        }
        Relationships: []
      }
      widget_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      widget_permissions: {
        Row: {
          can_add: boolean | null
          can_view: boolean | null
          granted_at: string
          granted_by: string | null
          id: string
          user_id: string
          widget_id: string
        }
        Insert: {
          can_add?: boolean | null
          can_view?: boolean | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
          widget_id: string
        }
        Update: {
          can_add?: boolean | null
          can_view?: boolean | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_permissions_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      widgets: {
        Row: {
          available_filters: Json | null
          builder_config: Json | null
          category: string
          created_at: string
          created_by: string | null
          data_source: string
          default_filters: Json | null
          default_page: string
          default_sort_order: number | null
          default_visible: boolean
          description: string | null
          grid_cols: number | null
          icon: string | null
          id: string
          is_active: boolean
          is_default: boolean | null
          min_height: string | null
          name: string
          size: string
          sort_order: number | null
          type: string
          updated_at: string
          widget_key: string
        }
        Insert: {
          available_filters?: Json | null
          builder_config?: Json | null
          category?: string
          created_at?: string
          created_by?: string | null
          data_source?: string
          default_filters?: Json | null
          default_page?: string
          default_sort_order?: number | null
          default_visible?: boolean
          description?: string | null
          grid_cols?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          min_height?: string | null
          name: string
          size?: string
          sort_order?: number | null
          type?: string
          updated_at?: string
          widget_key: string
        }
        Update: {
          available_filters?: Json | null
          builder_config?: Json | null
          category?: string
          created_at?: string
          created_by?: string | null
          data_source?: string
          default_filters?: Json | null
          default_page?: string
          default_sort_order?: number | null
          default_visible?: boolean
          description?: string | null
          grid_cols?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          min_height?: string | null
          name?: string
          size?: string
          sort_order?: number | null
          type?: string
          updated_at?: string
          widget_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_members: { Args: { _admin_id: string }; Returns: string[] }
      get_user_team_admin: { Args: { _user_id: string }; Returns: string }
      has_module_permission: {
        Args: { _module: string; _permission?: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_team_admin: { Args: { _user_id: string }; Returns: boolean }
      is_team_member: {
        Args: { _admin_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "viewer"
      container_type:
        | "kpi_row_5"
        | "kpi_row_4"
        | "kpi_row_3"
        | "chart_full"
        | "chart_half"
        | "chart_third"
        | "info_cards_3"
        | "info_cards_2"
        | "table_full"
        | "list_full"
        | "custom_grid"
      widget_category: "dashboard" | "satis" | "finans" | "cari"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "viewer"],
      container_type: [
        "kpi_row_5",
        "kpi_row_4",
        "kpi_row_3",
        "chart_full",
        "chart_half",
        "chart_third",
        "info_cards_3",
        "info_cards_2",
        "table_full",
        "list_full",
        "custom_grid",
      ],
      widget_category: ["dashboard", "satis", "finans", "cari"],
    },
  },
} as const
