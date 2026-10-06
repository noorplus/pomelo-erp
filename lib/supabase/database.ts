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
      account_transactions: {
        Row: {
          account_id: string
          contact_id: string | null
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
          line_number: number
          organization_id: string
        }
        Insert: {
          account_id: string
          contact_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
          line_number: number
          organization_id: string
        }
        Update: {
          account_id?: string
          contact_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
          line_number?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_account_fk"
            columns: ["organization_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "account_transactions_contact_fk"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "account_transactions_journal_fk"
            columns: ["organization_id", "journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "account_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          end_date: string
          id: string
          name: string
          organization_id: string
          start_date: string
          status: Database["public"]["Enums"]["accounting_period_status"]
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          name: string
          organization_id: string
          start_date: string
          status?: Database["public"]["Enums"]["accounting_period_status"]
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          organization_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["accounting_period_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: string
          created_at: string
          id: string
          is_active: boolean
          is_control_account: boolean
          is_postable: boolean
          is_system_account: boolean
          normal_balance: string
          organization_id: string
          parent_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_control_account?: boolean
          is_postable?: boolean
          is_system_account?: boolean
          normal_balance: string
          organization_id: string
          parent_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_control_account?: boolean
          is_postable?: boolean
          is_system_account?: boolean
          normal_balance?: string
          organization_id?: string
          parent_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_fk"
            columns: ["organization_id", "parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          contact_number: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          category_code: string
          created_at: string
          expense_account_id: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          category_code: string
          created_at?: string
          expense_account_id: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          category_code?: string
          created_at?: string
          expense_account_id?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_account_fk"
            columns: ["organization_id", "expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_category_id: string
          expense_date: string
          expense_number: string | null
          id: string
          organization_id: string
          payable_account_id: string
          posted_journal_entry_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category_id: string
          expense_date: string
          expense_number?: string | null
          id?: string
          organization_id: string
          payable_account_id: string
          posted_journal_entry_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category_id?: string
          expense_date?: string
          expense_number?: string | null
          id?: string
          organization_id?: string
          payable_account_id?: string
          posted_journal_entry_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_fk"
            columns: ["organization_id", "expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "expenses_contact_fk"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "expenses_journal_fk"
            columns: ["organization_id", "posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_payable_account_fk"
            columns: ["organization_id", "payable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      inventory_balances: {
        Row: {
          average_cost: number
          id: string
          inventory_value: number
          organization_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          average_cost?: number
          id?: string
          inventory_value?: number
          organization_id: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          average_cost?: number
          id?: string
          inventory_value?: number
          organization_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_balances_product_fk"
            columns: ["organization_id", "product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          average_cost_after: number
          created_at: string
          created_by: string | null
          direction: string
          id: string
          organization_id: string
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          total_value: number
          transaction_date: string
          transaction_number: string
          transaction_type: string
          unit_cost: number
          unit_cost_before: number | null
        }
        Insert: {
          average_cost_after: number
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          organization_id: string
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          total_value: number
          transaction_date: string
          transaction_number: string
          transaction_type: string
          unit_cost: number
          unit_cost_before?: number | null
        }
        Update: {
          average_cost_after?: number
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          total_value?: number
          transaction_date?: string
          transaction_number?: string
          transaction_type?: string
          unit_cost?: number
          unit_cost_before?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_fk"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          accounting_period_id: string
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          entry_number: string | null
          entry_type: Database["public"]["Enums"]["journal_entry_type"]
          id: string
          organization_id: string
          posted_at: string | null
          reference_id: string | null
          reference_type: string | null
          reversal_of_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
        }
        Insert: {
          accounting_period_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date: string
          entry_number?: string | null
          entry_type: Database["public"]["Enums"]["journal_entry_type"]
          id?: string
          organization_id: string
          posted_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_of_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Update: {
          accounting_period_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string | null
          entry_type?: Database["public"]["Enums"]["journal_entry_type"]
          id?: string
          organization_id?: string
          posted_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_of_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_period_fk"
            columns: ["organization_id", "accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_fk"
            columns: ["organization_id", "reversal_of_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      number_sequences: {
        Row: {
          created_at: string
          document_type: string
          id: string
          is_active: boolean
          next_number: number
          organization_id: string
          padding: number
          prefix: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          is_active?: boolean
          next_number?: number
          organization_id: string
          padding?: number
          prefix: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          is_active?: boolean
          next_number?: number
          organization_id?: string
          padding?: number
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "number_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          base_currency: string
          bin: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          timezone: string
          tin: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          base_currency?: string
          bin?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          timezone?: string
          tin?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          base_currency?: string
          bin?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          timezone?: string
          tin?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          document_id: string
          document_type: string
          id: string
          organization_id: string
          payment_id: string
          updated_at: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          document_id: string
          document_type: string
          id?: string
          organization_id: string
          payment_id: string
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          document_id?: string
          document_type?: string
          id?: string
          organization_id?: string
          payment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_fk"
            columns: ["organization_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string
          amount: number
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          payment_date: string
          payment_number: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          posted_journal_entry_id: string | null
          settlement_account_id: string
          status: Database["public"]["Enums"]["document_status"]
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          payment_date: string
          payment_number?: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          posted_journal_entry_id?: string | null
          settlement_account_id: string
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          payment_date?: string
          payment_number?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          posted_journal_entry_id?: string | null
          settlement_account_id?: string
          status?: Database["public"]["Enums"]["document_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_fk"
            columns: ["organization_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payments_contact_fk"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payments_journal_fk"
            columns: ["organization_id", "posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_settlement_account_fk"
            columns: ["organization_id", "settlement_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          cogs_account_id: string
          created_at: string
          created_by: string | null
          id: string
          inventory_account_id: string
          is_active: boolean
          name: string
          organization_id: string
          product_code: string | null
          sales_account_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          cogs_account_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_account_id: string
          is_active?: boolean
          name: string
          organization_id: string
          product_code?: string | null
          sales_account_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          cogs_account_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_account_id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          product_code?: string | null
          sales_account_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_cogs_account_fk"
            columns: ["organization_id", "cogs_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "products_inventory_account_fk"
            columns: ["organization_id", "inventory_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sales_account_fk"
            columns: ["organization_id", "sales_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "products_unit_fk"
            columns: ["organization_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      purchase: {
        Row: {
          created_at: string
          created_by: string | null
          discount_amount: number
          id: string
          invoice_date: string
          invoice_id: string | null
          organization_id: string
          payable_account_id: string
          posted_journal_entry_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          invoice_date: string
          invoice_id?: string | null
          organization_id: string
          payable_account_id: string
          posted_journal_entry_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          invoice_date?: string
          invoice_id?: string | null
          organization_id?: string
          payable_account_id?: string
          posted_journal_entry_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_journal_fk"
            columns: ["organization_id", "posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payable_account_fk"
            columns: ["organization_id", "payable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_supplier_fk"
            columns: ["organization_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          line_number: number
          line_total: number
          organization_id: string
          product_id: string
          purchase_id: string
          quantity: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_number: number
          line_total: number
          organization_id: string
          product_id: string
          purchase_id: string
          quantity: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          line_number?: number
          line_total?: number
          organization_id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_fk"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_fk"
            columns: ["organization_id", "purchase_id"]
            isOneToOne: false
            referencedRelation: "purchase"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      purchase_return_items: {
        Row: {
          created_at: string
          id: string
          line_number: number
          line_total: number
          organization_id: string
          product_id: string
          purchase_item_id: string
          purchase_return_id: string
          quantity: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_number: number
          line_total: number
          organization_id: string
          product_id: string
          purchase_item_id: string
          purchase_return_id: string
          quantity: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          line_number?: number
          line_total?: number
          organization_id?: string
          product_id?: string
          purchase_item_id?: string
          purchase_return_id?: string
          quantity?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_product_fk"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_return_items_purchase_item_fk"
            columns: ["organization_id", "purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_return_items_return_fk"
            columns: ["organization_id", "purchase_return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          created_at: string
          created_by: string | null
          discount_amount: number
          id: string
          organization_id: string
          payable_account_id: string
          posted_journal_entry_id: string | null
          purchase_id: string
          return_date: string
          return_number: string | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          organization_id: string
          payable_account_id: string
          posted_journal_entry_id?: string | null
          purchase_id: string
          return_date: string
          return_number?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          organization_id?: string
          payable_account_id?: string
          posted_journal_entry_id?: string | null
          purchase_id?: string
          return_date?: string
          return_number?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_journal_fk"
            columns: ["organization_id", "posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_payable_account_fk"
            columns: ["organization_id", "payable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_returns_purchase_fk"
            columns: ["organization_id", "purchase_id"]
            isOneToOne: false
            referencedRelation: "purchase"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_returns_supplier_fk"
            columns: ["organization_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          id: string
          invoice_date: string
          invoice_id: string | null
          organization_id: string
          posted_journal_entry_id: string | null
          receivable_account_id: string
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_amount?: number
          id?: string
          invoice_date: string
          invoice_id?: string | null
          organization_id: string
          posted_journal_entry_id?: string | null
          receivable_account_id: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_amount?: number
          id?: string
          invoice_date?: string
          invoice_id?: string | null
          organization_id?: string
          posted_journal_entry_id?: string | null
          receivable_account_id?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_fk"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_journal_fk"
            columns: ["organization_id", "posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_receivable_account_fk"
            columns: ["organization_id", "receivable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      sales_items: {
        Row: {
          cogs_total: number
          cogs_unit_cost: number
          created_at: string
          id: string
          line_number: number
          line_total: number
          organization_id: string
          product_id: string
          quantity: number
          sales_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          cogs_total?: number
          cogs_unit_cost?: number
          created_at?: string
          id?: string
          line_number: number
          line_total: number
          organization_id: string
          product_id: string
          quantity: number
          sales_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          cogs_total?: number
          cogs_unit_cost?: number
          created_at?: string
          id?: string
          line_number?: number
          line_total?: number
          organization_id?: string
          product_id?: string
          quantity?: number
          sales_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_items_product_fk"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_items_sales_fk"
            columns: ["organization_id", "sales_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      sales_return_items: {
        Row: {
          cogs_total: number
          cogs_unit_cost: number
          created_at: string
          id: string
          line_number: number
          line_total: number
          organization_id: string
          product_id: string
          quantity: number
          sales_item_id: string
          sales_return_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          cogs_total?: number
          cogs_unit_cost?: number
          created_at?: string
          id?: string
          line_number: number
          line_total: number
          organization_id: string
          product_id: string
          quantity: number
          sales_item_id: string
          sales_return_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          cogs_total?: number
          cogs_unit_cost?: number
          created_at?: string
          id?: string
          line_number?: number
          line_total?: number
          organization_id?: string
          product_id?: string
          quantity?: number
          sales_item_id?: string
          sales_return_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_return_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_return_items_product_fk"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_return_items_return_fk"
            columns: ["organization_id", "sales_return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_return_items_sales_item_fk"
            columns: ["organization_id", "sales_item_id"]
            isOneToOne: false
            referencedRelation: "sales_items"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          id: string
          organization_id: string
          posted_journal_entry_id: string | null
          receivable_account_id: string
          return_date: string
          return_number: string | null
          sales_id: string
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_amount?: number
          id?: string
          organization_id: string
          posted_journal_entry_id?: string | null
          receivable_account_id: string
          return_date: string
          return_number?: string | null
          sales_id: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_amount?: number
          id?: string
          organization_id?: string
          posted_journal_entry_id?: string | null
          receivable_account_id?: string
          return_date?: string
          return_number?: string | null
          sales_id?: string
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_customer_fk"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_returns_journal_fk"
            columns: ["organization_id", "posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_receivable_account_fk"
            columns: ["organization_id", "receivable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_returns_sales_fk"
            columns: ["organization_id", "sales_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      units_of_measure: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_of_measure_organization_id_fkey"
            columns: ["organization_id"]
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
      add_organization_user: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: undefined
      }
      add_organization_user_by_email: {
        Args: { p_email: string; p_organization_id: string }
        Returns: string
      }
      cancel_expense: {
        Args: { p_cancel_date?: string; p_id: string }
        Returns: string
      }
      cancel_journal_entry: {
        Args: { p_cancel_date?: string; p_journal_entry_id: string }
        Returns: string
      }
      cancel_payment: {
        Args: { p_cancel_date?: string; p_id: string }
        Returns: string
      }
      cancel_purchase: {
        Args: { p_cancel_date?: string; p_id: string }
        Returns: string
      }
      cancel_purchase_return: {
        Args: { p_cancel_date?: string; p_id: string }
        Returns: string
      }
      cancel_sales: {
        Args: { p_cancel_date?: string; p_id: string }
        Returns: string
      }
      cancel_sales_return: {
        Args: { p_cancel_date?: string; p_id: string }
        Returns: string
      }
      close_accounting_period: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      confirm_expense: { Args: { p_id: string }; Returns: string }
      confirm_journal_entry: {
        Args: { p_journal_entry_id: string }
        Returns: string
      }
      confirm_payment: { Args: { p_id: string }; Returns: string }
      confirm_purchase: { Args: { p_id: string }; Returns: string }
      confirm_purchase_return: { Args: { p_id: string }; Returns: string }
      confirm_sales: { Args: { p_id: string }; Returns: string }
      confirm_sales_return: { Args: { p_id: string }; Returns: string }
      create_accounting_period: {
        Args: {
          p_end_date: string
          p_name: string
          p_organization_id: string
          p_start_date: string
        }
        Returns: string
      }
      is_org_member: { Args: { p_organization_id: string }; Returns: boolean }
      is_organization_creator: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: boolean
      }
      onboard_organization: {
        Args: { p_base_currency?: string; p_name: string; p_timezone?: string }
        Returns: string
      }
      post_opening_setup: {
        Args: {
          p_description: string
          p_journal_lines: Json
          p_opening_date: string
          p_organization_id: string
          p_stock_lines: Json
        }
        Returns: string
      }
      remove_organization_user: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: undefined
      }
      remove_organization_user_by_email: {
        Args: { p_email: string; p_organization_id: string }
        Returns: string
      }
      validate_journal_balance: {
        Args: { p_journal_entry_id: string }
        Returns: undefined
      }
    }
    Enums: {
      accounting_period_status: "OPEN" | "CLOSED"
      document_status: "DRAFT" | "CONFIRMED" | "CANCELLED"
      journal_entry_type:
        | "PURCHASE"
        | "SALES"
        | "PURCHASE_RETURN"
        | "SALES_RETURN"
        | "EXPENSE"
        | "PAYMENT"
        | "OPENING"
        | "ADJUSTMENT"
        | "OTHER"
      payment_type: "RECEIPT" | "PAYMENT"
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
      accounting_period_status: ["OPEN", "CLOSED"],
      document_status: ["DRAFT", "CONFIRMED", "CANCELLED"],
      journal_entry_type: [
        "PURCHASE",
        "SALES",
        "PURCHASE_RETURN",
        "SALES_RETURN",
        "EXPENSE",
        "PAYMENT",
        "OPENING",
        "ADJUSTMENT",
        "OTHER",
      ],
      payment_type: ["RECEIPT", "PAYMENT"],
    },
  },
} as const
