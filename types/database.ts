export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      subscription_tiers: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price_cents: number;
          billing_interval: "one_time" | "month" | "year";
          stripe_price_id: string | null;
          features: Json;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          price_cents?: number;
          billing_interval?: "one_time" | "month" | "year";
          stripe_price_id?: string | null;
          features?: Json;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscription_tiers"]["Insert"]>;
        Relationships: [];
      };
      content_items: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          content_type: "file" | "video" | "image" | "document" | "bundle_manifest" | "link";
          machine_slug: string | null;
          tier_key: string | null;
          asset_key: string;
          storage_bucket: string;
          file_name: string | null;
          mime_type: string | null;
          file_size_bytes: number | null;
          checksum_sha256: string | null;
          status: "draft" | "review" | "approved" | "published" | "archived";
          subscriber_only: boolean;
          published_at: string | null;
          created_by: string | null;
          approved_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          content_type?: "file" | "video" | "image" | "document" | "bundle_manifest" | "link";
          machine_slug?: string | null;
          tier_key?: string | null;
          asset_key: string;
          storage_bucket?: string;
          file_name?: string | null;
          mime_type?: string | null;
          file_size_bytes?: number | null;
          checksum_sha256?: string | null;
          status?: "draft" | "review" | "approved" | "published" | "archived";
          subscriber_only?: boolean;
          published_at?: string | null;
          created_by?: string | null;
          approved_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "content_items_tier_key_fkey";
            columns: ["tier_key"];
            referencedRelation: "subscription_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
      content_drops: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          machine_slug: string | null;
          tier_key: string | null;
          subscriber_only: boolean;
          release_at: string;
          released_at: string | null;
          status: "draft" | "scheduled" | "released" | "archived";
          created_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          machine_slug?: string | null;
          tier_key?: string | null;
          subscriber_only?: boolean;
          release_at: string;
          released_at?: string | null;
          status?: "draft" | "scheduled" | "released" | "archived";
          created_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_drops"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "content_drops_tier_key_fkey";
            columns: ["tier_key"];
            referencedRelation: "subscription_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
      content_drop_items: {
        Row: {
          drop_id: string;
          content_item_id: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          drop_id: string;
          content_item_id: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_drop_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "content_drop_items_content_item_id_fkey";
            columns: ["content_item_id"];
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_drop_items_drop_id_fkey";
            columns: ["drop_id"];
            referencedRelation: "content_drops";
            referencedColumns: ["id"];
          },
        ];
      };
      content_reviews: {
        Row: {
          id: string;
          content_item_id: string;
          reviewer_id: string | null;
          status: "pending" | "approved" | "rejected" | "changes_requested";
          notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content_item_id: string;
          reviewer_id?: string | null;
          status?: "pending" | "approved" | "rejected" | "changes_requested";
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_reviews"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "content_reviews_content_item_id_fkey";
            columns: ["content_item_id"];
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
        ];
      };
      content_bundles: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          machine_slug: string | null;
          tier_key: string | null;
          product_id: string | null;
          price_cents: number | null;
          subscriber_only: boolean;
          status: "draft" | "published" | "archived";
          created_by: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          machine_slug?: string | null;
          tier_key?: string | null;
          product_id?: string | null;
          price_cents?: number | null;
          subscriber_only?: boolean;
          status?: "draft" | "published" | "archived";
          created_by?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_bundles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "content_bundles_tier_key_fkey";
            columns: ["tier_key"];
            referencedRelation: "subscription_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
      bundle_items: {
        Row: {
          bundle_id: string;
          content_item_id: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          bundle_id: string;
          content_item_id: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bundle_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey";
            columns: ["bundle_id"];
            referencedRelation: "content_bundles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bundle_items_content_item_id_fkey";
            columns: ["content_item_id"];
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
        ];
      };
      download_logs: {
        Row: {
          id: string;
          user_id: string | null;
          content_item_id: string | null;
          bundle_id: string | null;
          drop_id: string | null;
          product_id: string | null;
          asset_key: string;
          signed_url_expires_at: string | null;
          ip_address: string | null;
          user_agent: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          content_item_id?: string | null;
          bundle_id?: string | null;
          drop_id?: string | null;
          product_id?: string | null;
          asset_key: string;
          signed_url_expires_at?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["download_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "download_logs_bundle_id_fkey";
            columns: ["bundle_id"];
            referencedRelation: "content_bundles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "download_logs_content_item_id_fkey";
            columns: ["content_item_id"];
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "download_logs_drop_id_fkey";
            columns: ["drop_id"];
            referencedRelation: "content_drops";
            referencedColumns: ["id"];
          },
        ];
      };
      email_logs: {
        Row: {
          id: string;
          user_id: string | null;
          recipient: string;
          template_key: string;
          subject: string | null;
          provider: string | null;
          provider_message_id: string | null;
          status: "queued" | "sent" | "failed" | "skipped";
          related_drop_id: string | null;
          related_content_item_id: string | null;
          error_message: string | null;
          metadata: Json;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          recipient: string;
          template_key: string;
          subject?: string | null;
          provider?: string | null;
          provider_message_id?: string | null;
          status?: "queued" | "sent" | "failed" | "skipped";
          related_drop_id?: string | null;
          related_content_item_id?: string | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          sent_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["email_logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "email_logs_related_content_item_id_fkey";
            columns: ["related_content_item_id"];
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_logs_related_drop_id_fkey";
            columns: ["related_drop_id"];
            referencedRelation: "content_drops";
            referencedColumns: ["id"];
          },
        ];
      };
      content_analytics: {
        Row: {
          id: string;
          content_item_id: string | null;
          drop_id: string | null;
          bundle_id: string | null;
          user_id: string | null;
          event_type: "view" | "download" | "purchase" | "email_open" | "email_click" | "review";
          session_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_item_id?: string | null;
          drop_id?: string | null;
          bundle_id?: string | null;
          user_id?: string | null;
          event_type: "view" | "download" | "purchase" | "email_open" | "email_click" | "review";
          session_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_analytics"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "content_analytics_bundle_id_fkey";
            columns: ["bundle_id"];
            referencedRelation: "content_bundles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_analytics_content_item_id_fkey";
            columns: ["content_item_id"];
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_analytics_drop_id_fkey";
            columns: ["drop_id"];
            referencedRelation: "content_drops";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_entitlements: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          tier_key: string | null;
          machine_slug: string | null;
          source: "checkout" | "subscription" | "manual";
          status: "active" | "inactive" | "expired" | "cancelled";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_checkout_session_id: string | null;
          expires_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          tier_key?: string | null;
          machine_slug?: string | null;
          source: "checkout" | "subscription" | "manual";
          status?: "active" | "inactive" | "expired" | "cancelled";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_checkout_session_id?: string | null;
          expires_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_entitlements"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "customer_entitlements_tier_key_fkey";
            columns: ["tier_key"];
            referencedRelation: "subscription_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          id: string;
          event_type: string;
          processed_at: string;
        };
        Insert: {
          id: string;
          event_type: string;
          processed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stripe_events"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
