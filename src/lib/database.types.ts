export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string;
          email: string;
        };
        Insert: {
          created_at?: string;
          email: string;
        };
        Update: {
          created_at?: string;
          email?: string;
        };
        Relationships: [];
      };
      business_categories: {
        Row: {
          business_id: string;
          category_id: string;
          created_at: string | null;
        };
        Insert: {
          business_id: string;
          category_id: string;
          created_at?: string | null;
        };
        Update: {
          business_id?: string;
          category_id?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_categories_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_categories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      business_claims: {
        Row: {
          business_id: string;
          claimer_email: string | null;
          created_at: string;
          id: string;
          message: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          business_id: string;
          claimer_email?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          business_id?: string;
          claimer_email?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_claims_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_events: {
        Row: {
          business_id: string;
          created_at: string;
          event: string;
          id: number;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          event: string;
          id?: never;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          event?: string;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: "business_events_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_hours: {
        Row: {
          business_id: string;
          close_time: string | null;
          day_of_week: number;
          id: string;
          is_closed: boolean | null;
          is_open_24: boolean;
          open_time: string | null;
        };
        Insert: {
          business_id: string;
          close_time?: string | null;
          day_of_week: number;
          id?: string;
          is_closed?: boolean | null;
          is_open_24?: boolean;
          open_time?: string | null;
        };
        Update: {
          business_id?: string;
          close_time?: string | null;
          day_of_week?: number;
          id?: string;
          is_closed?: boolean | null;
          is_open_24?: boolean;
          open_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_offers: {
        Row: {
          business_id: string;
          created_at: string;
          description: string | null;
          expires_at: string;
          id: string;
          title: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          description?: string | null;
          expires_at: string;
          id?: string;
          title: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          description?: string | null;
          expires_at?: string;
          id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_offers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_photos: {
        Row: {
          business_id: string;
          created_at: string | null;
          id: string;
          is_cover: boolean | null;
          position: number | null;
          url: string;
        };
        Insert: {
          business_id: string;
          created_at?: string | null;
          id?: string;
          is_cover?: boolean | null;
          position?: number | null;
          url: string;
        };
        Update: {
          business_id?: string;
          created_at?: string | null;
          id?: string;
          is_cover?: boolean | null;
          position?: number | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_photos_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          address: string | null;
          created_at: string | null;
          description: string | null;
          featured_until: string | null;
          id: string;
          instagram: string | null;
          is_active: boolean | null;
          is_featured: boolean | null;
          is_verified: boolean | null;
          lat: number | null;
          lng: number | null;
          name: string;
          owner_id: string | null;
          phone: string | null;
          plan: string | null;
          priority: number | null;
          seo_description: string | null;
          seo_title: string | null;
          services: string | null;
          slug: string;
          status: string;
          updated_at: string | null;
          website: string | null;
          whatsapp: string | null;
          whatsapp_message: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string | null;
          description?: string | null;
          featured_until?: string | null;
          id?: string;
          instagram?: string | null;
          is_active?: boolean | null;
          is_featured?: boolean | null;
          is_verified?: boolean | null;
          lat?: number | null;
          lng?: number | null;
          name: string;
          owner_id?: string | null;
          phone?: string | null;
          plan?: string | null;
          priority?: number | null;
          seo_description?: string | null;
          seo_title?: string | null;
          services?: string | null;
          slug: string;
          status?: string;
          updated_at?: string | null;
          website?: string | null;
          whatsapp?: string | null;
          whatsapp_message?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string | null;
          description?: string | null;
          featured_until?: string | null;
          id?: string;
          instagram?: string | null;
          is_active?: boolean | null;
          is_featured?: boolean | null;
          is_verified?: boolean | null;
          lat?: number | null;
          lng?: number | null;
          name?: string;
          owner_id?: string | null;
          phone?: string | null;
          plan?: string | null;
          priority?: number | null;
          seo_description?: string | null;
          seo_title?: string | null;
          services?: string | null;
          slug?: string;
          status?: string;
          updated_at?: string | null;
          website?: string | null;
          whatsapp?: string | null;
          whatsapp_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "businesses_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string | null;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          slug: string;
          sort_order: number | null;
        };
        Insert: {
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          slug: string;
          sort_order?: number | null;
        };
        Update: {
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          slug?: string;
          sort_order?: number | null;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string;
          phone: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name: string;
          phone?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string;
          phone?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      directory_entries: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          is_active: boolean;
          is_priority: boolean;
          phone: string;
          position: number;
          subtitle: string | null;
          title: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_priority?: boolean;
          phone: string;
          position?: number;
          subtitle?: string | null;
          title: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_priority?: boolean;
          phone?: string;
          position?: number;
          subtitle?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      // Agregada a mano (2026-07-12, sección Eventos): si regenerás los tipos
      // con supabase gen types, esta entrada sale sola de la base.
      events: {
        Row: {
          created_at: string;
          date: string;
          description: string | null;
          end_date: string | null;
          end_time: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          location: string | null;
          start_time: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          description?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          location?: string | null;
          start_time?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          description?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          location?: string | null;
          start_time?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      pharmacy_turns: {
        Row: {
          created_at: string | null;
          ends_at: string;
          id: string;
          pharmacy_id: string;
          starts_at: string;
        };
        Insert: {
          created_at?: string | null;
          ends_at: string;
          id?: string;
          pharmacy_id: string;
          starts_at: string;
        };
        Update: {
          created_at?: string | null;
          ends_at?: string;
          id?: string;
          pharmacy_id?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pharmacy_turns_pharmacy_id_fkey";
            columns: ["pharmacy_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string | null;
          full_name: string | null;
          id: string;
          role: string | null;
        };
        Insert: {
          created_at?: string | null;
          full_name?: string | null;
          id: string;
          role?: string | null;
        };
        Update: {
          created_at?: string | null;
          full_name?: string | null;
          id?: string;
          role?: string | null;
        };
        Relationships: [];
      };
      site_alerts: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          is_active: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          is_active?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          is_active?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          business_id: string;
          created_at: string;
          current_period_end: string | null;
          external_id: string | null;
          id: string;
          provider: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          created_at?: string;
          current_period_end?: string | null;
          external_id?: string | null;
          id?: string;
          provider?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          created_at?: string;
          current_period_end?: string | null;
          external_id?: string | null;
          id?: string;
          provider?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_remove_owner: {
        Args: { p_business_id: string };
        Returns: undefined;
      };
      admin_resolve_claim: {
        Args: { p_approve: boolean; p_claim_id: string };
        Returns: undefined;
      };
      admin_set_business_status: {
        Args: { p_business_id: string; p_status: string };
        Returns: undefined;
      };
      admin_set_featured: {
        Args: { p_business_id: string; p_featured: boolean; p_until?: string };
        Returns: undefined;
      };
      get_business_stats: {
        Args: { p_business_id: string; p_days?: number };
        Returns: {
          current_total: number;
          event: string;
          previous_total: number;
        }[];
      };
      is_admin: { Args: never; Returns: boolean };
      today_ar: { Args: never; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
