export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      action_items: {
        Row: {
          assignee_user_id: string | null;
          content: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          due_date: string;
          id: string;
          meeting_id: string;
          status: Database["public"]["Enums"]["event_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_user_id?: string | null;
          content: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          due_date: string;
          id?: string;
          meeting_id: string;
          status?: Database["public"]["Enums"]["event_status"];
          updated_at?: string;
        };
        Update: {
          assignee_user_id?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          due_date?: string;
          id?: string;
          meeting_id?: string;
          status?: Database["public"]["Enums"]["event_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "action_items_assignee_user_id_fkey";
            columns: ["assignee_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_items_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_requests: {
        Row: {
          created_at: string;
          created_by: string | null;
          decided_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          deleted_at: string | null;
          id: string;
          project_id: string;
          requested_at: string;
          requested_by: string;
          snapshot: NonNullable<Json>;
          status: Database["public"]["Enums"]["approval_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["approval_target_type"];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id: string;
          requested_at?: string;
          requested_by: string;
          snapshot?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["approval_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["approval_target_type"];
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_reason?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id?: string;
          requested_at?: string;
          requested_by?: string;
          snapshot?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["approval_status"];
          target_id?: string;
          target_type?: Database["public"]["Enums"]["approval_target_type"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_requests_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_requests_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_requests_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          after: Json | null;
          at: string;
          before: Json | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          row_id: string;
          table_name: string;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          row_id: string;
          table_name: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          row_id?: string;
          table_name?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      business_projects: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          status: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_logs: {
        Row: {
          at: string;
          contact_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          meeting_id: string | null;
          method: string;
          summary: string;
          updated_at: string;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          at: string;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          meeting_id?: string | null;
          method: string;
          summary: string;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          at?: string;
          contact_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          meeting_id?: string | null;
          method?: string;
          summary?: string;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_logs_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "vendor_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_logs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_logs_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_logs_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_logs_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_amendments: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"];
          approved_at: string | null;
          approved_by: string | null;
          change_reason: string;
          contract_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          end_at: string;
          final_amount: number;
          final_vat: number;
          id: string;
          is_sealed: boolean;
          legacy_contract_id: string | null;
          original_location: string | null;
          previous_amount: number;
          previous_vat: number;
          sequence: number;
          signed_at: string;
          start_at: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"];
          approved_at?: string | null;
          approved_by?: string | null;
          change_reason: string;
          contract_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          end_at: string;
          final_amount: number;
          final_vat: number;
          id?: string;
          is_sealed?: boolean;
          legacy_contract_id?: string | null;
          original_location?: string | null;
          previous_amount: number;
          previous_vat: number;
          sequence: number;
          signed_at: string;
          start_at: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"];
          approved_at?: string | null;
          approved_by?: string | null;
          change_reason?: string;
          contract_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          end_at?: string;
          final_amount?: number;
          final_vat?: number;
          id?: string;
          is_sealed?: boolean;
          legacy_contract_id?: string | null;
          original_location?: string | null;
          previous_amount?: number;
          previous_vat?: number;
          sequence?: number;
          signed_at?: string;
          start_at?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contract_amendments_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_amendments_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_amendments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contract_amendments_legacy_contract_id_fkey";
            columns: ["legacy_contract_id"];
            isOneToOne: true;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
        ];
      };
      contracts: {
        Row: {
          amount: number;
          approval_status: Database["public"]["Enums"]["approval_status"];
          approved_at: string | null;
          approved_by: string | null;
          change_reason: string | null;
          contract_party: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          end_at: string;
          id: string;
          is_sealed: boolean;
          original_location: string | null;
          parent_contract_id: string | null;
          project_id: string;
          signed_at: string;
          start_at: string;
          title: string;
          updated_at: string;
          vat: number;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          approval_status?: Database["public"]["Enums"]["approval_status"];
          approved_at?: string | null;
          approved_by?: string | null;
          change_reason?: string | null;
          contract_party: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          end_at: string;
          id?: string;
          is_sealed?: boolean;
          original_location?: string | null;
          parent_contract_id?: string | null;
          project_id: string;
          signed_at: string;
          start_at: string;
          title: string;
          updated_at?: string;
          vat?: number;
          vendor_id: string;
        };
        Update: {
          amount?: number;
          approval_status?: Database["public"]["Enums"]["approval_status"];
          approved_at?: string | null;
          approved_by?: string | null;
          change_reason?: string | null;
          contract_party?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          end_at?: string;
          id?: string;
          is_sealed?: boolean;
          original_location?: string | null;
          parent_contract_id?: string | null;
          project_id?: string;
          signed_at?: string;
          start_at?: string;
          title?: string;
          updated_at?: string;
          vat?: number;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_parent_contract_id_fkey";
            columns: ["parent_contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          file_name: string;
          file_path: string;
          id: string;
          kind: string;
          owner_id: string;
          owner_type: string;
          updated_at: string;
          valid_until: string | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          file_name: string;
          file_path: string;
          id?: string;
          kind: string;
          owner_id: string;
          owner_type: string;
          updated_at?: string;
          valid_until?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          file_name?: string;
          file_path?: string;
          id?: string;
          kind?: string;
          owner_id?: string;
          owner_type?: string;
          updated_at?: string;
          valid_until?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      erp_sync_outbox: {
        Row: {
          aggregate_id: string;
          aggregate_type: string;
          attempts: number;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          event_type: string;
          id: string;
          last_error: string | null;
          payload: NonNullable<Json>;
          status: Database["public"]["Enums"]["erp_sync_status"];
          synced_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          aggregate_id: string;
          aggregate_type: string;
          attempts?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          event_type: string;
          id?: string;
          last_error?: string | null;
          payload: NonNullable<Json>;
          status?: Database["public"]["Enums"]["erp_sync_status"];
          synced_at?: string | null;
          updated_at?: string;
        };
        Update: {
          aggregate_id?: string;
          aggregate_type?: string;
          attempts?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          event_type?: string;
          id?: string;
          last_error?: string | null;
          payload?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["erp_sync_status"];
          synced_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "erp_sync_outbox_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          deleted_at: string | null;
          end_date: string | null;
          id: string;
          memo: string | null;
          project_id: string | null;
          source_id: string | null;
          source_type: string | null;
          status: Database["public"]["Enums"]["event_status"];
          title: string;
          type: Database["public"]["Enums"]["event_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          deleted_at?: string | null;
          end_date?: string | null;
          id?: string;
          memo?: string | null;
          project_id?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          status?: Database["public"]["Enums"]["event_status"];
          title: string;
          type: Database["public"]["Enums"]["event_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          deleted_at?: string | null;
          end_date?: string | null;
          id?: string;
          memo?: string | null;
          project_id?: string | null;
          source_id?: string | null;
          source_type?: string | null;
          status?: Database["public"]["Enums"]["event_status"];
          title?: string;
          type?: Database["public"]["Enums"]["event_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_public";
            referencedColumns: ["id"];
          },
        ];
      };
      guarantees: {
        Row: {
          amount: number;
          contract_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          expires_at: string;
          id: string;
          issuer: string | null;
          starts_at: string;
          type: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount?: number;
          contract_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          expires_at: string;
          id?: string;
          issuer?: string | null;
          starts_at: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          contract_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          expires_at?: string;
          id?: string;
          issuer?: string | null;
          starts_at?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guarantees_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guarantees_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      meetings: {
        Row: {
          agenda: string;
          attendees_union: string | null;
          attendees_vendor: string | null;
          created_at: string;
          created_by: string | null;
          decisions: string | null;
          deleted_at: string | null;
          held_at: string;
          id: string;
          method: string;
          notes: string | null;
          project_id: string;
          updated_at: string;
          vendor_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          agenda: string;
          attendees_union?: string | null;
          attendees_vendor?: string | null;
          created_at?: string;
          created_by?: string | null;
          decisions?: string | null;
          deleted_at?: string | null;
          held_at: string;
          id?: string;
          method: string;
          notes?: string | null;
          project_id: string;
          updated_at?: string;
          vendor_id?: string | null;
        };
        Update: {
          agenda?: string;
          attendees_union?: string | null;
          attendees_vendor?: string | null;
          created_at?: string;
          created_by?: string | null;
          decisions?: string | null;
          deleted_at?: string | null;
          held_at?: string;
          id?: string;
          method?: string;
          notes?: string | null;
          project_id?: string;
          updated_at?: string;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meetings_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_logs: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          event_id: string;
          id: string;
          provider_message_id: string | null;
          recipient_user_id: string;
          sent_at: string;
          stage: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          event_id: string;
          id?: string;
          provider_message_id?: string | null;
          recipient_user_id: string;
          sent_at?: string;
          stage: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          event_id?: string;
          id?: string;
          provider_message_id?: string | null;
          recipient_user_id?: string;
          sent_at?: string;
          stage?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_logs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_logs_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_logs_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_schedules: {
        Row: {
          amount: number;
          contract_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          due_date: string;
          id: string;
          label: string;
          paid_at: string | null;
          seq: number;
          settlement_status: Database["public"]["Enums"]["settlement_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          contract_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          due_date: string;
          id?: string;
          label: string;
          paid_at?: string | null;
          seq: number;
          settlement_status?: Database["public"]["Enums"]["settlement_status"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          contract_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          due_date?: string;
          id?: string;
          label?: string;
          paid_at?: string | null;
          seq?: number;
          settlement_status?: Database["public"]["Enums"]["settlement_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_schedules_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_schedules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      project_assignees: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          project_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_assignees_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_assignees_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_assignees_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_assignees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      project_internal_notes: {
        Row: {
          content: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          project_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_internal_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_internal_notes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_internal_notes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_public";
            referencedColumns: ["id"];
          },
        ];
      };
      project_vendors: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          project_id: string;
          reason: string | null;
          role: string;
          updated_at: string;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id: string;
          reason?: string | null;
          role: string;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id?: string;
          reason?: string | null;
          role?: string;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_vendors_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_vendors_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_vendors_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_vendors_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_vendors_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          board_resolution: string | null;
          budget: number;
          business_project_id: string;
          category: Database["public"]["Enums"]["project_category"];
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          owner_user_id: string | null;
          selected_vendor_id: string | null;
          selection_reason: string | null;
          stage: Database["public"]["Enums"]["project_stage"];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          board_resolution?: string | null;
          budget?: number;
          business_project_id: string;
          category: Database["public"]["Enums"]["project_category"];
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          owner_user_id?: string | null;
          selected_vendor_id?: string | null;
          selection_reason?: string | null;
          stage?: Database["public"]["Enums"]["project_stage"];
          title: string;
          updated_at?: string;
        };
        Update: {
          board_resolution?: string | null;
          budget?: number;
          business_project_id?: string;
          category?: Database["public"]["Enums"]["project_category"];
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          owner_user_id?: string | null;
          selected_vendor_id?: string | null;
          selection_reason?: string | null;
          stage?: Database["public"]["Enums"]["project_stage"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_business_project_id_fkey";
            columns: ["business_project_id"];
            isOneToOne: false;
            referencedRelation: "business_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_selected_vendor_id_fkey";
            columns: ["selected_vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_selected_vendor_id_fkey";
            columns: ["selected_vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          duration_days: number | null;
          id: string;
          items: NonNullable<Json>;
          note: string | null;
          payment_terms: string | null;
          project_id: string;
          received_at: string;
          updated_at: string;
          vat_included: boolean;
          vendor_id: string;
          version: number;
          warranty_months: number | null;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          duration_days?: number | null;
          id?: string;
          items?: NonNullable<Json>;
          note?: string | null;
          payment_terms?: string | null;
          project_id: string;
          received_at: string;
          updated_at?: string;
          vat_included?: boolean;
          vendor_id: string;
          version: number;
          warranty_months?: number | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          duration_days?: number | null;
          id?: string;
          items?: NonNullable<Json>;
          note?: string | null;
          payment_terms?: string | null;
          project_id?: string;
          received_at?: string;
          updated_at?: string;
          vat_included?: boolean;
          vendor_id?: string;
          version?: number;
          warranty_months?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          email: string;
          id: string;
          name: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email: string;
          id: string;
          name: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      vendor_contacts: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          duty: string | null;
          email: string | null;
          id: string;
          is_primary: boolean;
          name: string;
          phone: string | null;
          title: string | null;
          updated_at: string;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          duty?: string | null;
          email?: string | null;
          id?: string;
          is_primary?: boolean;
          name: string;
          phone?: string | null;
          title?: string | null;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          duty?: string | null;
          email?: string | null;
          id?: string;
          is_primary?: boolean;
          name?: string;
          phone?: string | null;
          title?: string | null;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      vendor_financial_details: {
        Row: {
          bank_account: string | null;
          bank_name: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          updated_at: string;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          bank_account?: string | null;
          bank_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          bank_account?: string | null;
          bank_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendor_financial_details_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_financial_details_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_financial_details_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      vendor_internal_notes: {
        Row: {
          content: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          updated_at: string;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendor_internal_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_internal_notes_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_internal_notes_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      vendor_reviews: {
        Row: {
          comment: string | null;
          communication: number;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          project_id: string;
          quality: number;
          schedule: number;
          updated_at: string;
          vendor_id: string;
        };
        ComputedFields: never;
        Insert: {
          comment?: string | null;
          communication: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id: string;
          quality: number;
          schedule: number;
          updated_at?: string;
          vendor_id: string;
        };
        Update: {
          comment?: string | null;
          communication?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          project_id?: string;
          quality?: number;
          schedule?: number;
          updated_at?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_reviews_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_reviews_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      vendors: {
        Row: {
          address: string | null;
          biz_no: string | null;
          category: string | null;
          ceo: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          homepage: string | null;
          id: string;
          memo: string | null;
          name: string;
          phone: string | null;
          related_person: string | null;
          related_person_phone: string | null;
          status: Database["public"]["Enums"]["vendor_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          biz_no?: string | null;
          category?: string | null;
          ceo?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          homepage?: string | null;
          id?: string;
          memo?: string | null;
          name: string;
          phone?: string | null;
          related_person?: string | null;
          related_person_phone?: string | null;
          status?: Database["public"]["Enums"]["vendor_status"];
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          biz_no?: string | null;
          category?: string | null;
          ceo?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          homepage?: string | null;
          id?: string;
          memo?: string | null;
          name?: string;
          phone?: string | null;
          related_person?: string | null;
          related_person_phone?: string | null;
          status?: Database["public"]["Enums"]["vendor_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      projects_public: {
        Row: {
          board_resolution: string | null;
          budget: number;
          business_project_id: string;
          category: Database["public"]["Enums"]["project_category"];
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          owner_user_id: string | null;
          selected_vendor_id: string | null;
          selection_reason: string | null;
          stage: Database["public"]["Enums"]["project_stage"];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          board_resolution?: string | null;
          budget?: number | null;
          business_project_id?: string | null;
          category?: Database["public"]["Enums"]["project_category"] | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string | null;
          owner_user_id?: string | null;
          selected_vendor_id?: string | null;
          selection_reason?: string | null;
          stage?: Database["public"]["Enums"]["project_stage"] | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Update: {
          board_resolution?: string | null;
          budget?: number | null;
          business_project_id?: string | null;
          category?: Database["public"]["Enums"]["project_category"] | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string | null;
          owner_user_id?: string | null;
          selected_vendor_id?: string | null;
          selection_reason?: string | null;
          stage?: Database["public"]["Enums"]["project_stage"] | null;
          title?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_business_project_id_fkey";
            columns: ["business_project_id"];
            isOneToOne: false;
            referencedRelation: "business_projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_selected_vendor_id_fkey";
            columns: ["selected_vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_selected_vendor_id_fkey";
            columns: ["selected_vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors_public";
            referencedColumns: ["id"];
          },
        ];
      };
      vendors_public: {
        Row: {
          address: string | null;
          biz_no: string | null;
          category: string | null;
          ceo: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          homepage: string | null;
          id: string;
          memo: string | null;
          name: string;
          phone: string | null;
          related_person: string | null;
          related_person_phone: string | null;
          status: Database["public"]["Enums"]["vendor_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          biz_no?: string | null;
          category?: string | null;
          ceo?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          homepage?: string | null;
          id?: string | null;
          memo?: string | null;
          name?: string | null;
          phone?: string | null;
          related_person?: string | null;
          related_person_phone?: string | null;
          status?: Database["public"]["Enums"]["vendor_status"] | null;
          updated_at?: string | null;
        };
        Update: {
          address?: string | null;
          biz_no?: string | null;
          category?: string | null;
          ceo?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          homepage?: string | null;
          id?: string | null;
          memo?: string | null;
          name?: string | null;
          phone?: string | null;
          related_person?: string | null;
          related_person_phone?: string | null;
          status?: Database["public"]["Enums"]["vendor_status"] | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vendors_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      create_contract_with_payments: {
        Args: {
          amount_value: number;
          change_reason_value?: string;
          contract_party_value: string;
          end_at_value: string;
          is_sealed_value: boolean;
          original_location_value: string;
          parent_contract_id_value?: string;
          payment_rows?: Json;
          project_id_value: string;
          signed_at_value: string;
          start_at_value: string;
          title_value: string;
          vat_value: number;
          vendor_id_value: string;
        };
        Returns: string;
      };
      create_meeting_with_actions: {
        Args: {
          action_rows?: Json;
          agenda_value: string;
          attendees_union_value: string;
          attendees_vendor_value: string;
          decisions_value: string;
          held_at_value: string;
          method_value: string;
          notes_value: string;
          project_id_value: string;
          vendor_id_value: string;
        };
        Returns: string;
      };
      current_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      decide_approval: {
        Args: {
          approval_id_value: string;
          decision_reason_value?: string;
          decision_value: Database["public"]["Enums"]["approval_status"];
        };
        Returns: undefined;
      };
      mark_overdue_events: { Args: Record<PropertyKey, never>; Returns: number };
      request_vendor_selection: {
        Args: {
          board_resolution_value: string;
          selection_reason_value: string;
          target_project_id: string;
          target_vendor_id: string;
        };
        Returns: string;
      };
      save_vendor_with_primary_contact: {
        Args: {
          address_value?: string;
          bank_account_value?: string;
          bank_name_value?: string;
          biz_no_value?: string;
          category_value?: string;
          ceo_value?: string;
          homepage_value?: string;
          internal_note_value?: string;
          memo_value?: string;
          name_value?: string;
          phone_value?: string;
          primary_contact_name_value?: string;
          primary_contact_phone_value?: string;
          related_person_phone_value?: string;
          related_person_value?: string;
          status_value?: Database["public"]["Enums"]["vendor_status"];
          vendor_id_value?: string;
        };
        Returns: string;
      };
      save_vendor_with_sensitive: {
        Args: {
          address_value?: string;
          bank_account_value?: string;
          bank_name_value?: string;
          biz_no_value?: string;
          category_value?: string;
          ceo_value?: string;
          homepage_value?: string;
          internal_note_value?: string;
          memo_value?: string;
          name_value?: string;
          phone_value?: string;
          related_person_phone_value?: string;
          related_person_value?: string;
          status_value?: Database["public"]["Enums"]["vendor_status"];
          vendor_id_value?: string;
        };
        Returns: string;
      };
      select_project_vendor: {
        Args: {
          board_resolution_value: string;
          selection_reason_value: string;
          target_project_id: string;
          target_vendor_id: string;
        };
        Returns: undefined;
      };
      submit_contract_approval: {
        Args: {
          target_id_value: string;
          target_type_value: Database["public"]["Enums"]["approval_target_type"];
        };
        Returns: string;
      };
      verify_daily_reminder_token: { Args: { input_token: string }; Returns: boolean };
    };
    Enums: {
      approval_status: "draft" | "requested" | "approved" | "rejected" | "cancelled";
      approval_target_type: "vendor_selection" | "contract" | "contract_amendment";
      erp_sync_status: "pending" | "sent" | "failed";
      event_status: "예정" | "진행" | "완료" | "지연";
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
        | "기타";
      project_category: "사업관리" | "토지" | "홍보관·사무실" | "광고·홍보" | "기타";
      project_stage:
        | "견적요청"
        | "비교검토"
        | "선정"
        | "계약"
        | "진행"
        | "준공"
        | "정산완료"
        | "보류";
      settlement_status: "미정산" | "정산요청" | "정산완료";
      user_role: "admin" | "executive" | "staff" | "agent" | "viewer";
      vendor_status:
        | "후보"
        | "견적중"
        | "선정"
        | "계약협의"
        | "계약중"
        | "완료"
        | "탈락"
        | "거래중지";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      approval_status: ["draft", "requested", "approved", "rejected", "cancelled"],
      approval_target_type: ["vendor_selection", "contract", "contract_amendment"],
      erp_sync_status: ["pending", "sent", "failed"],
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
      project_category: ["사업관리", "토지", "홍보관·사무실", "광고·홍보", "기타"],
      project_stage: ["견적요청", "비교검토", "선정", "계약", "진행", "준공", "정산완료", "보류"],
      settlement_status: ["미정산", "정산요청", "정산완료"],
      user_role: ["admin", "executive", "staff", "agent", "viewer"],
      vendor_status: ["후보", "견적중", "선정", "계약협의", "계약중", "완료", "탈락", "거래중지"],
    },
  },
} as const;
