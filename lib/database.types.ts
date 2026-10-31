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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          assignee_user_id: string | null
          content: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_date: string
          id: string
          meeting_id: string
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
        }
        Insert: {
          assignee_user_id?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date: string
          id?: string
          meeting_id: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Update: {
          assignee_user_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string
          id?: string
          meeting_id?: string
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_assignee_user_id_fkey"
            columns: ["assignee_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after: Json | null
          at: string
          before: Json | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          row_id: string
          table_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          at?: string
          before?: Json | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          row_id: string
          table_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          at?: string
          before?: Json | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          row_id?: string
          table_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_logs: {
        Row: {
          at: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          meeting_id: string | null
          method: string
          summary: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          at: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meeting_id?: string | null
          method: string
          summary: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          at?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          meeting_id?: string | null
          method?: string
          summary?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "vendor_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_logs_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount: number
          change_reason: string | null
          contract_party: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_at: string
          id: string
          is_sealed: boolean
          original_location: string | null
          parent_contract_id: string | null
          project_id: string
          signed_at: string
          start_at: string
          title: string
          updated_at: string
          vat: number
          vendor_id: string
        }
        Insert: {
          amount: number
          change_reason?: string | null
          contract_party: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_at: string
          id?: string
          is_sealed?: boolean
          original_location?: string | null
          parent_contract_id?: string | null
          project_id: string
          signed_at: string
          start_at: string
          title: string
          updated_at?: string
          vat?: number
          vendor_id: string
        }
        Update: {
          amount?: number
          change_reason?: string | null
          contract_party?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_at?: string
          id?: string
          is_sealed?: boolean
          original_location?: string | null
          parent_contract_id?: string | null
          project_id?: string
          signed_at?: string
          start_at?: string
          title?: string
          updated_at?: string
          vat?: number
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          file_name: string
          file_path: string
          id: string
          kind: string
          owner_id: string
          owner_type: string
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          file_name: string
          file_path: string
          id?: string
          kind: string
          owner_id: string
          owner_type: string
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          file_name?: string
          file_path?: string
          id?: string
          kind?: string
          owner_id?: string
          owner_type?: string
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          deleted_at: string | null
          end_date: string | null
          id: string
          memo: string | null
          project_id: string | null
          source_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["event_status"]
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          memo?: string | null
          project_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          memo?: string | null
          project_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantees: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expires_at: string
          id: string
          issuer: string | null
          starts_at: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          contract_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at: string
          id?: string
          issuer?: string | null
          starts_at: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expires_at?: string
          id?: string
          issuer?: string | null
          starts_at?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantees_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string
          attendees_union: string | null
          attendees_vendor: string | null
          created_at: string
          created_by: string | null
          decisions: string | null
          deleted_at: string | null
          held_at: string
          id: string
          method: string
          notes: string | null
          project_id: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          agenda: string
          attendees_union?: string | null
          attendees_vendor?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          deleted_at?: string | null
          held_at: string
          id?: string
          method: string
          notes?: string | null
          project_id: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          agenda?: string
          attendees_union?: string | null
          attendees_vendor?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          deleted_at?: string | null
          held_at?: string
          id?: string
          method?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_date: string
          id: string
          label: string
          paid_at: string | null
          seq: number
          settlement_status: Database["public"]["Enums"]["settlement_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date: string
          id?: string
          label: string
          paid_at?: string | null
          seq: number
          settlement_status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string
          id?: string
          label?: string
          paid_at?: string | null
          seq?: number
          settlement_status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignees: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_vendors: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          project_id: string
          reason: string | null
          role: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          project_id: string
          reason?: string | null
          role: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          project_id?: string
          reason?: string | null
          role?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_vendors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_vendors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          board_resolution: string | null
          budget: number
          category: Database["public"]["Enums"]["project_category"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          internal_note: string | null
          owner_user_id: string | null
          selected_vendor_id: string | null
          selection_reason: string | null
          stage: Database["public"]["Enums"]["project_stage"]
          title: string
          updated_at: string
        }
        Insert: {
          board_resolution?: string | null
          budget?: number
          category: Database["public"]["Enums"]["project_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          internal_note?: string | null
          owner_user_id?: string | null
          selected_vendor_id?: string | null
          selection_reason?: string | null
          stage?: Database["public"]["Enums"]["project_stage"]
          title: string
          updated_at?: string
        }
        Update: {
          board_resolution?: string | null
          budget?: number
          category?: Database["public"]["Enums"]["project_category"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          internal_note?: string | null
          owner_user_id?: string | null
          selected_vendor_id?: string | null
          selection_reason?: string | null
          stage?: Database["public"]["Enums"]["project_stage"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_selected_vendor_id_fkey"
            columns: ["selected_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_selected_vendor_id_fkey"
            columns: ["selected_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duration_days: number | null
          id: string
          items: Json
          note: string | null
          payment_terms: string | null
          project_id: string
          received_at: string
          updated_at: string
          vat_included: boolean
          vendor_id: string
          version: number
          warranty_months: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_days?: number | null
          id?: string
          items?: Json
          note?: string | null
          payment_terms?: string | null
          project_id: string
          received_at: string
          updated_at?: string
          vat_included?: boolean
          vendor_id: string
          version: number
          warranty_months?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duration_days?: number | null
          id?: string
          items?: Json
          note?: string | null
          payment_terms?: string | null
          project_id?: string
          received_at?: string
          updated_at?: string
          vat_included?: boolean
          vendor_id?: string
          version?: number
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string
          id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email: string
          id: string
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_contacts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          duty: string | null
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          title: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duty?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          title?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          duty?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          title?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reviews: {
        Row: {
          comment: string | null
          communication: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          project_id: string
          quality: number
          schedule: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          comment?: string | null
          communication: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          project_id: string
          quality: number
          schedule: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          comment?: string | null
          communication?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          project_id?: string
          quality?: number
          schedule?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_name: string | null
          biz_no: string | null
          category: string | null
          ceo: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          homepage: string | null
          id: string
          internal_note: string | null
          memo: string | null
          name: string
          status: Database["public"]["Enums"]["vendor_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          biz_no?: string | null
          category?: string | null
          ceo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          homepage?: string | null
          id?: string
          internal_note?: string | null
          memo?: string | null
          name: string
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          biz_no?: string | null
          category?: string | null
          ceo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          homepage?: string | null
          id?: string
          internal_note?: string | null
          memo?: string | null
          name?: string
          status?: Database["public"]["Enums"]["vendor_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      projects_public: {
        Row: {
          board_resolution: string | null
          budget: number | null
          category: Database["public"]["Enums"]["project_category"] | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string | null
          owner_user_id: string | null
          selected_vendor_id: string | null
          selection_reason: string | null
          stage: Database["public"]["Enums"]["project_stage"] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          board_resolution?: string | null
          budget?: number | null
          category?: Database["public"]["Enums"]["project_category"] | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          owner_user_id?: string | null
          selected_vendor_id?: string | null
          selection_reason?: string | null
          stage?: Database["public"]["Enums"]["project_stage"] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          board_resolution?: string | null
          budget?: number | null
          category?: Database["public"]["Enums"]["project_category"] | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          owner_user_id?: string | null
          selected_vendor_id?: string | null
          selection_reason?: string | null
          stage?: Database["public"]["Enums"]["project_stage"] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_selected_vendor_id_fkey"
            columns: ["selected_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_selected_vendor_id_fkey"
            columns: ["selected_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors_public"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors_public: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_name: string | null
          biz_no: string | null
          category: string | null
          ceo: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          homepage: string | null
          id: string | null
          memo: string | null
          name: string | null
          status: Database["public"]["Enums"]["vendor_status"] | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          biz_no?: string | null
          category?: string | null
          ceo?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          homepage?: string | null
          id?: string | null
          memo?: string | null
          name?: string | null
          status?: Database["public"]["Enums"]["vendor_status"] | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          biz_no?: string | null
          category?: string | null
          ceo?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          homepage?: string | null
          id?: string | null
          memo?: string | null
          name?: string | null
          status?: Database["public"]["Enums"]["vendor_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      mark_overdue_events: { Args: never; Returns: number }
      select_project_vendor: {
        Args: {
          board_resolution_value: string
          selection_reason_value: string
          target_project_id: string
          target_vendor_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      event_status: "예정" | "진행" | "완료" | "지연"
      event_type:
        | "견적마감"
        | "업체미팅"
        | "이사회상정"
        | "계약체결"
        | "착수"
        | "중간점검"
        | "대금지급"
        | "준공"
        | "보증만료"
        | "후속조치"
        | "기타"
      project_category:
        | "사업관리"
        | "토지"
        | "홍보관·사무실"
        | "광고·홍보"
        | "기타"
      project_stage:
        | "견적요청"
        | "비교검토"
        | "선정"
        | "계약"
        | "진행"
        | "준공"
        | "정산완료"
        | "보류"
      settlement_status: "미정산" | "정산요청" | "정산완료"
      user_role: "admin" | "executive" | "staff" | "agent" | "viewer"
      vendor_status:
        | "후보"
        | "견적중"
        | "선정"
        | "계약중"
        | "완료"
        | "탈락"
        | "거래중지"
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
    Enums: {
      event_status: ["예정", "진행", "완료", "지연"],
      event_type: [
        "견적마감",
        "업체미팅",
        "이사회상정",
        "계약체결",
        "착수",
        "중간점검",
        "대금지급",
        "준공",
        "보증만료",
        "후속조치",
        "기타",
      ],
      project_category: [
        "사업관리",
        "토지",
        "홍보관·사무실",
        "광고·홍보",
        "기타",
      ],
      project_stage: [
        "견적요청",
        "비교검토",
        "선정",
        "계약",
        "진행",
        "준공",
        "정산완료",
        "보류",
      ],
      settlement_status: ["미정산", "정산요청", "정산완료"],
      user_role: ["admin", "executive", "staff", "agent", "viewer"],
      vendor_status: [
        "후보",
        "견적중",
        "선정",
        "계약중",
        "완료",
        "탈락",
        "거래중지",
      ],
    },
  },
} as const

