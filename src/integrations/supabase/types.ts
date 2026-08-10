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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      aggregate_reports: {
        Row: {
          case_count: number
          content: Json
          created_at: string
          created_by: string
          id: string
          org_id: string
          period_end: string
          period_start: string
          product_name: string
          report_type: string
          serious_count: number
          status: string
          summary: string
        }
        Insert: {
          case_count?: number
          content?: Json
          created_at?: string
          created_by: string
          id?: string
          org_id: string
          period_end: string
          period_start: string
          product_name: string
          report_type: string
          serious_count?: number
          status?: string
          summary: string
        }
        Update: {
          case_count?: number
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          org_id?: string
          period_end?: string
          period_start?: string
          product_name?: string
          report_type?: string
          serious_count?: number
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "aggregate_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          case_id: string | null
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          org_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          org_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          org_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_audit_events: {
        Row: {
          action: string
          actor_id: string
          actor_name: string
          after_state: Json | null
          before_state: Json | null
          case_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json | null
          org_id: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_name: string
          after_state?: Json | null
          before_state?: Json | null
          case_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string
          after_state?: Json | null
          before_state?: Json | null
          case_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_audit_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_codings: {
        Row: {
          case_id: string
          coded_by: string
          created_at: string
          dictionary_version: string
          id: string
          meddra_soc: string | null
          meddra_term: string
          org_id: string
        }
        Insert: {
          case_id: string
          coded_by: string
          created_at?: string
          dictionary_version?: string
          id?: string
          meddra_soc?: string | null
          meddra_term: string
          org_id: string
        }
        Update: {
          case_id?: string
          coded_by?: string
          created_at?: string
          dictionary_version?: string
          id?: string
          meddra_soc?: string | null
          meddra_term?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_codings_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_codings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_follow_ups: {
        Row: {
          case_id: string
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          org_id: string
          owner_id: string | null
          request: string
          response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          org_id: string
          owner_id?: string | null
          request: string
          response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          org_id?: string
          owner_id?: string | null
          request?: string
          response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_follow_ups_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_follow_ups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_follow_ups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_submissions: {
        Row: {
          attestation_text: string
          attested_by: string
          case_id: string
          created_at: string
          destination: string
          id: string
          message_type: string
          org_id: string
          payload_preview: string | null
          state: string
        }
        Insert: {
          attestation_text: string
          attested_by: string
          case_id: string
          created_at?: string
          destination?: string
          id?: string
          message_type?: string
          org_id: string
          payload_preview?: string | null
          state?: string
        }
        Update: {
          attestation_text?: string
          attested_by?: string
          case_id?: string
          created_at?: string
          destination?: string
          id?: string
          message_type?: string
          org_id?: string
          payload_preview?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_submissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_submissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assigned_to: string | null
          batch_number: string | null
          case_number: string
          channel: string
          coding_complete: boolean
          created_at: string
          created_by: string
          criteria_death: boolean
          criteria_disability: boolean
          criteria_hospitalization: boolean
          criteria_life_threatening: boolean
          criteria_other: boolean
          due_date: string
          event_description: string | null
          follow_up_count: number
          id: string
          meddra_soc: string | null
          meddra_term: string | null
          medical_review_complete: boolean
          narrative: string | null
          onset_date: string | null
          org_id: string
          outcome: string | null
          patient_age: number | null
          patient_initials: string | null
          patient_sex: string | null
          product_id: string | null
          product_name: string
          qc_complete: boolean
          received_date: string
          report_type: string
          reporter_contact: string | null
          reporter_name: string | null
          reporter_type: string | null
          seriousness: Database["public"]["Enums"]["seriousness"]
          severity: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["case_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          batch_number?: string | null
          case_number: string
          channel?: string
          coding_complete?: boolean
          created_at?: string
          created_by: string
          criteria_death?: boolean
          criteria_disability?: boolean
          criteria_hospitalization?: boolean
          criteria_life_threatening?: boolean
          criteria_other?: boolean
          due_date: string
          event_description?: string | null
          follow_up_count?: number
          id?: string
          meddra_soc?: string | null
          meddra_term?: string | null
          medical_review_complete?: boolean
          narrative?: string | null
          onset_date?: string | null
          org_id: string
          outcome?: string | null
          patient_age?: number | null
          patient_initials?: string | null
          patient_sex?: string | null
          product_id?: string | null
          product_name: string
          qc_complete?: boolean
          received_date?: string
          report_type?: string
          reporter_contact?: string | null
          reporter_name?: string | null
          reporter_type?: string | null
          seriousness?: Database["public"]["Enums"]["seriousness"]
          severity?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          batch_number?: string | null
          case_number?: string
          channel?: string
          coding_complete?: boolean
          created_at?: string
          created_by?: string
          criteria_death?: boolean
          criteria_disability?: boolean
          criteria_hospitalization?: boolean
          criteria_life_threatening?: boolean
          criteria_other?: boolean
          due_date?: string
          event_description?: string | null
          follow_up_count?: number
          id?: string
          meddra_soc?: string | null
          meddra_term?: string | null
          medical_review_complete?: boolean
          narrative?: string | null
          onset_date?: string | null
          org_id?: string
          outcome?: string | null
          patient_age?: number | null
          patient_initials?: string | null
          patient_sex?: string | null
          product_id?: string | null
          product_name?: string
          qc_complete?: boolean
          received_date?: string
          report_type?: string
          reporter_contact?: string | null
          reporter_name?: string | null
          reporter_type?: string | null
          seriousness?: Database["public"]["Enums"]["seriousness"]
          severity?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          message: string
          org_id: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          message: string
          org_id: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          message?: string
          org_id?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          client_name: string | null
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          active?: boolean
          client_name?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          active?: boolean
          client_name?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          org_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          org_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          org_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qms_entries: {
        Row: {
          actor_id: string
          actor_name: string
          created_at: string
          description: string | null
          entry_type: string
          event: string
          id: string
          org_id: string
          reference: string | null
          status: string
        }
        Insert: {
          actor_id: string
          actor_name: string
          created_at?: string
          description?: string | null
          entry_type?: string
          event: string
          id?: string
          org_id: string
          reference?: string | null
          status?: string
        }
        Update: {
          actor_id?: string
          actor_name?: string
          created_at?: string
          description?: string | null
          entry_type?: string
          event?: string
          id?: string
          org_id?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "qms_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          notes: string | null
          org_id: string
          reviewer_id: string
          signal_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          notes?: string | null
          org_id: string
          reviewer_id: string
          signal_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          org_id?: string
          reviewer_id?: string
          signal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_reviews_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          case_count: number
          created_at: string
          id: string
          meddra_term: string
          notes: string | null
          org_id: string
          period_end: string | null
          period_start: string | null
          product_name: string
          review_decision: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          signal_ref: string
          status: Database["public"]["Enums"]["signal_status"]
          updated_at: string
        }
        Insert: {
          case_count?: number
          created_at?: string
          id?: string
          meddra_term: string
          notes?: string | null
          org_id: string
          period_end?: string | null
          period_start?: string | null
          product_name: string
          review_decision?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signal_ref: string
          status?: Database["public"]["Enums"]["signal_status"]
          updated_at?: string
        }
        Update: {
          case_count?: number
          created_at?: string
          id?: string
          meddra_term?: string
          notes?: string | null
          org_id?: string
          period_end?: string | null
          period_start?: string | null
          product_name?: string
          review_decision?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signal_ref?: string
          status?: Database["public"]["Enums"]["signal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_extracts: {
        Row: {
          confirmed_by: string | null
          created_at: string
          id: string
          meddra_term: string | null
          narrative: string | null
          org_id: string
          product_name: string | null
          serious_flag: boolean
          thread_id: string
        }
        Insert: {
          confirmed_by?: string | null
          created_at?: string
          id?: string
          meddra_term?: string | null
          narrative?: string | null
          org_id: string
          product_name?: string | null
          serious_flag?: boolean
          thread_id: string
        }
        Update: {
          confirmed_by?: string | null
          created_at?: string
          id?: string
          meddra_term?: string | null
          narrative?: string | null
          org_id?: string
          product_name?: string | null
          serious_flag?: boolean
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_extracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_extracts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          direction: string
          id: string
          org_id: string
          sender: string | null
          sent_at: string
          thread_id: string
        }
        Insert: {
          body: string
          direction: string
          id?: string
          org_id: string
          sender?: string | null
          sent_at?: string
          thread_id: string
        }
        Update: {
          body?: string
          direction?: string
          id?: string
          org_id?: string
          sender?: string | null
          sent_at?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_threads: {
        Row: {
          consent: boolean
          contact: string
          contact_name: string
          created_at: string
          criteria_event: boolean
          criteria_patient: boolean
          criteria_product: boolean
          criteria_reporter: boolean
          id: string
          linked_case_id: string | null
          org_id: string
          reporter_type: string | null
          status: Database["public"]["Enums"]["wa_status"]
          thread_ref: string
          updated_at: string
        }
        Insert: {
          consent?: boolean
          contact: string
          contact_name: string
          created_at?: string
          criteria_event?: boolean
          criteria_patient?: boolean
          criteria_product?: boolean
          criteria_reporter?: boolean
          id?: string
          linked_case_id?: string | null
          org_id: string
          reporter_type?: string | null
          status?: Database["public"]["Enums"]["wa_status"]
          thread_ref: string
          updated_at?: string
        }
        Update: {
          consent?: boolean
          contact?: string
          contact_name?: string
          created_at?: string
          criteria_event?: boolean
          criteria_patient?: boolean
          criteria_product?: boolean
          criteria_reporter?: boolean
          id?: string
          linked_case_id?: string | null
          org_id?: string
          reporter_type?: string | null
          status?: Database["public"]["Enums"]["wa_status"]
          thread_ref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_threads_linked_case_id_fkey"
            columns: ["linked_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_threads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_case: {
        Args: { _assigned: string; _created: string; _org: string }
        Returns: boolean
      }
      current_org: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      next_case_number: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "FIELD_ASSOCIATE" | "PV_COORDINATOR" | "PV_MANAGER" | "ADMIN"
      case_status:
        | "Triage"
        | "Coding"
        | "Medical Review"
        | "QC"
        | "Submitted"
        | "Closed"
      seriousness: "Serious" | "Non-serious"
      signal_status: "New" | "Under Validation" | "Confirmed" | "Refuted"
      wa_status: "New" | "Converted" | "Not Reportable"
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
      app_role: ["FIELD_ASSOCIATE", "PV_COORDINATOR", "PV_MANAGER", "ADMIN"],
      case_status: [
        "Triage",
        "Coding",
        "Medical Review",
        "QC",
        "Submitted",
        "Closed",
      ],
      seriousness: ["Serious", "Non-serious"],
      signal_status: ["New", "Under Validation", "Confirmed", "Refuted"],
      wa_status: ["New", "Converted", "Not Reportable"],
    },
  },
} as const
