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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      catalog_category_settings: {
        Row: {
          catalog_id: string
          category_id: string
          created_at: string
          custom_name: string | null
          id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          catalog_id: string
          category_id: string
          created_at?: string
          custom_name?: string | null
          id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          category_id?: string
          created_at?: string
          custom_name?: string | null
          id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_category_settings_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_category_settings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_product_settings: {
        Row: {
          catalog_id: string
          categories: string[] | null
          created_at: string
          id: string
          markup_type: string | null
          markup_value: number | null
          portion_prices: Json | null
          primary_category_id: string | null
          product_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          catalog_id: string
          categories?: string[] | null
          created_at?: string
          id?: string
          markup_type?: string | null
          markup_value?: number | null
          portion_prices?: Json | null
          primary_category_id?: string | null
          product_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          categories?: string[] | null
          created_at?: string
          id?: string
          markup_type?: string | null
          markup_value?: number | null
          portion_prices?: Json | null
          primary_category_id?: string | null
          product_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_product_settings_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_product_settings_primary_category_id_fkey"
            columns: ["primary_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_product_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogs: {
        Row: {
          access_code: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          access_code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          access_code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          store_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          store_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address: string
          created_at: string
          id: string
          is_default: boolean | null
          label: string | null
          last_used_at: string | null
          profile_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          last_used_at?: string | null
          profile_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          last_used_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_catalog_access: {
        Row: {
          catalog_id: string
          granted_at: string | null
          id: string
          store_customer_id: string
        }
        Insert: {
          catalog_id: string
          granted_at?: string | null
          id?: string
          store_customer_id: string
        }
        Update: {
          catalog_id?: string
          granted_at?: string | null
          id?: string
          store_customer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_catalog_access_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_catalog_access_store_customer_id_fkey"
            columns: ["store_customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_role_assignments: {
        Row: {
          created_at: string
          id: string
          role_id: string
          store_customer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          store_customer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          store_customer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "customer_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_role_assignments_store_customer_id_fkey"
            columns: ["store_customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number | null
          store_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
          store_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_roles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_slides: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean | null
          sort_order: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      livestream_chat_messages: {
        Row: {
          created_at: string | null
          id: string
          is_seller: boolean | null
          message: string
          sender_name: string
          store_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_seller?: boolean | null
          message: string
          sender_name: string
          store_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_seller?: boolean | null
          message?: string
          sender_name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestream_chat_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      moysklad_accounts: {
        Row: {
          created_at: string
          id: string
          last_sync: string | null
          login: string
          name: string
          password: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_sync?: string | null
          login: string
          name: string
          password: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sync?: string | null
          login?: string
          name?: string
          password?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moysklad_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          total: number
        }
        Insert: {
          id?: string
          order_id: string
          price: number
          product_id?: string | null
          product_name: string
          quantity: number
          total: number
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          discount: number | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_guest_order: boolean | null
          last_activity_at: string | null
          moysklad_order_id: string | null
          notes: string | null
          order_number: string
          shipping_address: Json | null
          shipping_cost: number | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_guest_order?: boolean | null
          last_activity_at?: string | null
          moysklad_order_id?: string | null
          notes?: string | null
          order_number: string
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_guest_order?: boolean | null
          last_activity_at?: string | null
          moysklad_order_id?: string | null
          notes?: string | null
          order_number?: string
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "store_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      product_catalog_visibility: {
        Row: {
          catalog_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_catalog_visibility_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_catalog_visibility_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_category_assignments: {
        Row: {
          category_id: string
          created_at: string
          id: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_group_assignments: {
        Row: {
          created_at: string
          group_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_group_assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_group_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number | null
          store_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
          store_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_groups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_role_visibility: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          product_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          product_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          product_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_role_visibility_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_role_visibility_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "customer_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          auto_sync: boolean | null
          buy_price: number | null
          category_id: string | null
          compare_price: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          images: string[] | null
          is_active: boolean | null
          markup_type: string | null
          markup_value: number | null
          moysklad_account_id: string | null
          moysklad_id: string | null
          name: string
          packaging_type: string | null
          portion_weight: number | null
          price: number
          price_full: number | null
          price_half: number | null
          price_portion: number | null
          price_quarter: number | null
          quantity: number
          seo_canonical_url: string | null
          seo_description: string | null
          seo_generated_at: string | null
          seo_keywords: string[] | null
          seo_noindex: boolean | null
          seo_og_image: string | null
          seo_schema: Json | null
          seo_title: string | null
          sku: string | null
          slug: string
          source: string | null
          store_id: string
          synced_moysklad_images: Json | null
          unit: string | null
          unit_weight: number | null
          updated_at: string
        }
        Insert: {
          auto_sync?: boolean | null
          buy_price?: number | null
          category_id?: string | null
          compare_price?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          markup_type?: string | null
          markup_value?: number | null
          moysklad_account_id?: string | null
          moysklad_id?: string | null
          name: string
          packaging_type?: string | null
          portion_weight?: number | null
          price: number
          price_full?: number | null
          price_half?: number | null
          price_portion?: number | null
          price_quarter?: number | null
          quantity?: number
          seo_canonical_url?: string | null
          seo_description?: string | null
          seo_generated_at?: string | null
          seo_keywords?: string[] | null
          seo_noindex?: boolean | null
          seo_og_image?: string | null
          seo_schema?: Json | null
          seo_title?: string | null
          sku?: string | null
          slug: string
          source?: string | null
          store_id: string
          synced_moysklad_images?: Json | null
          unit?: string | null
          unit_weight?: number | null
          updated_at?: string
        }
        Update: {
          auto_sync?: boolean | null
          buy_price?: number | null
          category_id?: string | null
          compare_price?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          markup_type?: string | null
          markup_value?: number | null
          moysklad_account_id?: string | null
          moysklad_id?: string | null
          name?: string
          packaging_type?: string | null
          portion_weight?: number | null
          price?: number
          price_full?: number | null
          price_half?: number | null
          price_portion?: number | null
          price_quarter?: number | null
          quantity?: number
          seo_canonical_url?: string | null
          seo_description?: string | null
          seo_generated_at?: string | null
          seo_keywords?: string[] | null
          seo_noindex?: boolean | null
          seo_og_image?: string | null
          seo_schema?: Json | null
          seo_title?: string | null
          sku?: string | null
          slug?: string
          source?: string | null
          store_id?: string
          synced_moysklad_images?: Json | null
          unit?: string | null
          unit_weight?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_moysklad_account_id_fkey"
            columns: ["moysklad_account_id"]
            isOneToOne: false
            referencedRelation: "moysklad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          toast_notifications_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          toast_notifications_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          toast_notifications_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_product_pricing: {
        Row: {
          created_at: string
          id: string
          markup_type: string
          markup_value: number
          product_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          markup_type?: string
          markup_value?: number
          product_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          markup_type?: string
          markup_value?: number
          product_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_product_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_product_pricing_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "customer_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_activity_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_activity_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_customers: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_notification_settings: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          id: string
          notification_email: string | null
          notification_telegram: string | null
          notification_whatsapp: string | null
          store_id: string
          telegram_enabled: boolean | null
          updated_at: string | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          notification_email?: string | null
          notification_telegram?: string | null
          notification_whatsapp?: string | null
          store_id: string
          telegram_enabled?: boolean | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          notification_email?: string | null
          notification_telegram?: string | null
          notification_whatsapp?: string | null
          store_id?: string
          telegram_enabled?: boolean | null
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "store_notification_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_sync_settings: {
        Row: {
          created_at: string
          enabled: boolean
          field_mapping: Json
          id: string
          interval_minutes: number
          last_sync_time: string | null
          moysklad_counterparty_id: string | null
          moysklad_organization_id: string | null
          next_sync_time: string | null
          store_id: string
          sync_orders_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          field_mapping?: Json
          id?: string
          interval_minutes?: number
          last_sync_time?: string | null
          moysklad_counterparty_id?: string | null
          moysklad_organization_id?: string | null
          next_sync_time?: string | null
          store_id: string
          sync_orders_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          field_mapping?: Json
          id?: string
          interval_minutes?: number
          last_sync_time?: string | null
          moysklad_counterparty_id?: string | null
          moysklad_organization_id?: string | null
          next_sync_time?: string | null
          store_id?: string
          sync_orders_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_sync_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          banner_url: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          custom_domain: string | null
          customers_count: number | null
          description: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          primary_color: string | null
          products_count: number | null
          retail_catalog_id: string | null
          retail_enabled: boolean | null
          retail_logo_url: string | null
          retail_name: string | null
          retail_phone: string | null
          retail_theme: Json | null
          secondary_color: string | null
          seo_description: string | null
          seo_title: string | null
          status: Database["public"]["Enums"]["store_status"]
          subdomain: string
          telegram_username: string | null
          updated_at: string
          whatsapp_phone: string | null
          wholesale_catalog_id: string | null
          wholesale_custom_domain: string | null
          wholesale_enabled: boolean | null
          wholesale_livestream_enabled: boolean | null
          wholesale_livestream_title: string | null
          wholesale_livestream_url: string | null
          wholesale_logo_url: string | null
          wholesale_min_order_amount: number | null
          wholesale_name: string | null
          wholesale_seo_description: string | null
          wholesale_seo_title: string | null
          wholesale_theme: Json | null
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_domain?: string | null
          customers_count?: number | null
          description?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          primary_color?: string | null
          products_count?: number | null
          retail_catalog_id?: string | null
          retail_enabled?: boolean | null
          retail_logo_url?: string | null
          retail_name?: string | null
          retail_phone?: string | null
          retail_theme?: Json | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_title?: string | null
          status?: Database["public"]["Enums"]["store_status"]
          subdomain: string
          telegram_username?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
          wholesale_catalog_id?: string | null
          wholesale_custom_domain?: string | null
          wholesale_enabled?: boolean | null
          wholesale_livestream_enabled?: boolean | null
          wholesale_livestream_title?: string | null
          wholesale_livestream_url?: string | null
          wholesale_logo_url?: string | null
          wholesale_min_order_amount?: number | null
          wholesale_name?: string | null
          wholesale_seo_description?: string | null
          wholesale_seo_title?: string | null
          wholesale_theme?: Json | null
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_domain?: string | null
          customers_count?: number | null
          description?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          primary_color?: string | null
          products_count?: number | null
          retail_catalog_id?: string | null
          retail_enabled?: boolean | null
          retail_logo_url?: string | null
          retail_name?: string | null
          retail_phone?: string | null
          retail_theme?: Json | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_title?: string | null
          status?: Database["public"]["Enums"]["store_status"]
          subdomain?: string
          telegram_username?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
          wholesale_catalog_id?: string | null
          wholesale_custom_domain?: string | null
          wholesale_enabled?: boolean | null
          wholesale_livestream_enabled?: boolean | null
          wholesale_livestream_title?: string | null
          wholesale_livestream_url?: string | null
          wholesale_logo_url?: string | null
          wholesale_min_order_amount?: number | null
          wholesale_name?: string | null
          wholesale_seo_description?: string | null
          wholesale_seo_title?: string | null
          wholesale_theme?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_retail_catalog_id_fkey"
            columns: ["retail_catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_wholesale_catalog_id_fkey"
            columns: ["wholesale_catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_catalog_by_access_code: {
        Args: { _access_code: string }
        Returns: {
          description: string
          id: string
          name: string
          store_id: string
          store_logo: string
          store_name: string
        }[]
      }
      get_catalog_products_public: {
        Args: { _access_code: string }
        Returns: {
          catalog_description: string
          catalog_id: string
          catalog_name: string
          category_id: string
          category_name: string
          category_slug: string
          product_compare_price: number
          product_description: string
          product_id: string
          product_images: string[]
          product_name: string
          product_packaging_type: string
          product_portion_weight: number
          product_price: number
          product_price_full: number
          product_price_half: number
          product_price_portion: number
          product_price_quarter: number
          product_quantity: number
          product_sku: string
          product_slug: string
          product_unit: string
          product_unit_weight: number
          setting_categories: string[]
          setting_markup_type: string
          setting_markup_value: number
          setting_portion_prices: Json
          setting_status: string
          store_description: string
          store_id: string
          store_logo: string
          store_name: string
        }[]
      }
      get_catalog_store_id: { Args: { _catalog_id: string }; Returns: string }
      get_retail_products_public: {
        Args: { _subdomain: string }
        Returns: {
          catalog_status: string
          category_id: string
          category_ids: string[]
          category_name: string
          compare_price: number
          description: string
          id: string
          images: string[]
          name: string
          packaging_type: string
          price: number
          quantity: number
          sku: string
          slug: string
          unit: string
        }[]
      }
      get_wholesale_products_public: {
        Args: { _subdomain: string }
        Returns: {
          buy_price: number
          catalog_status: string
          category_id: string
          category_ids: string[]
          category_name: string
          compare_price: number
          description: string
          id: string
          images: string[]
          name: string
          packaging_type: string
          price: number
          quantity: number
          seo_description: string
          seo_keywords: string[]
          seo_schema: Json
          seo_title: string
          sku: string
          slug: string
          unit: string
        }[]
      }
      has_catalog_access: {
        Args: { _catalog_id: string; _user_id: string }
        Returns: boolean
      }
      has_platform_role: {
        Args: {
          _role: Database["public"]["Enums"]["platform_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_store_customer: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_store_owner: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_store_owner_of_customer: {
        Args: { customer_profile_id: string }
        Returns: boolean
      }
    }
    Enums: {
      order_status:
        | "forming"
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      platform_role: "super_admin"
      store_status: "pending" | "active" | "suspended"
      user_role: "seller" | "customer"
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
      order_status: [
        "forming",
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      platform_role: ["super_admin"],
      store_status: ["pending", "active", "suspended"],
      user_role: ["seller", "customer"],
    },
  },
} as const
