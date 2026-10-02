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
            foreignKeyName: "account_transactions_organization_id_account_id_fkey"
            columns: ["organization_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "account_transactions_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "account_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transactions_organization_id_journal_entry_id_fkey"
            columns: ["organization_id", "journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      accounting_periods: {
        Row: {
          closed_at: string | null
          created_at: string
          end_date: string
          id: string
          name: string
          organization_id: string
          start_date: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          end_date: string
          id?: string
          name: string
          organization_id: string
          start_date: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          organization_id?: string
          start_date?: string
          status?: string
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
            foreignKeyName: "accounts_organization_id_parent_account_id_fkey"
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
          contact_number: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          contact_number: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          contact_number?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
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
        }
        Insert: {
          category_code: string
          created_at?: string
          expense_account_id: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
        }
        Update: {
          category_code?: string
          created_at?: string
          expense_account_id?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_expense_account_id_fkey"
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
          expense_number: string
          id: string
          organization_id: string
          payable_account_id: string | null
          posted_journal_entry_id: string | null
          status: string
        }
        Insert: {
          amount: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category_id: string
          expense_date: string
          expense_number: string
          id?: string
          organization_id: string
          payable_account_id?: string | null
          posted_journal_entry_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category_id?: string
          expense_date?: string
          expense_number?: string
          id?: string
          organization_id?: string
          payable_account_id?: string | null
          posted_journal_entry_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "expenses_organization_id_expense_category_id_fkey"
            columns: ["organization_id", "expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
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
            foreignKeyName: "expenses_organization_id_posted_journal_entry_id_fkey"
            columns: ["organization_id", "posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
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
            foreignKeyName: "inventory_balances_organization_id_product_id_fkey"
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
          reference_id: string
          reference_type: string
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
          reference_id: string
          reference_type: string
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
          reference_id?: string
          reference_type?: string
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
            foreignKeyName: "inventory_transactions_organization_id_product_id_fkey"
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
          entry_number: string
          entry_type: string
          id: string
          organization_id: string
          posted_at: string | null
          reference_id: string | null
          reference_type: string | null
          reversal_of_id: string | null
          status: string
        }
        Insert: {
          accounting_period_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date: string
          entry_number: string
          entry_type: string
          id?: string
          organization_id: string
          posted_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_of_id?: string | null
          status?: string
        }
        Update: {
          accounting_period_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string
          entry_type?: string
          id?: string
          organization_id?: string
          posted_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_of_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_organization_id_accounting_period_id_fkey"
            columns: ["organization_id", "accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_organization_id_reversal_of_id_fkey"
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
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          is_active?: boolean
          next_number?: number
          organization_id: string
          padding?: number
          prefix?: string
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
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          role?: string
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
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          phone: string | null
          tax_number: string | null
          timezone: string
        }
        Insert: {
          address?: string | null
          base_currency?: string
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          phone?: string | null
          tax_number?: string | null
          timezone?: string
        }
        Update: {
          address?: string | null
          base_currency?: string
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          phone?: string | null
          tax_number?: string | null
          timezone?: string
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
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          document_id: string
          document_type: string
          id?: string
          organization_id: string
          payment_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          document_id?: string
          document_type?: string
          id?: string
          organization_id?: string
          payment_id?: string
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
            foreignKeyName: "payment_allocations_organization_id_payment_id_fkey"
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
          payment_number: string
          payment_type: string
          posted_journal_entry_id: string | null
          settlement_account_id: string | null
          status: string
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
          payment_number: string
          payment_type: string
          posted_journal_entry_id?: string | null
          settlement_account_id?: string | null
          status?: string
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
          payment_number?: string
          payment_type?: string
          posted_journal_entry_id?: string | null
          settlement_account_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_account_id_fkey"
            columns: ["organization_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payments_organization_id_contact_id_fkey"
            columns: ["organization_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
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
            foreignKeyName: "payments_organization_id_posted_journal_entry_id_fkey"
            columns: ["organization_id", "posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payments_organization_id_settlement_account_id_fkey"
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
          description: string | null
          id: string
          inventory_account_id: string
          is_active: boolean
          name: string
          organization_id: string
          product_code: string
          sales_account_id: string
          unit_id: string
        }
        Insert: {
          cogs_account_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          inventory_account_id: string
          is_active?: boolean
          name: string
          organization_id: string
          product_code: string
          sales_account_id: string
          unit_id: string
        }
        Update: {
          cogs_account_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          inventory_account_id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          product_code?: string
          sales_account_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_cogs_account_id_fkey"
            columns: ["organization_id", "cogs_account_id"]
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
            foreignKeyName: "products_organization_id_inventory_account_id_fkey"
            columns: ["organization_id", "inventory_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "products_organization_id_sales_account_id_fkey"
            columns: ["organization_id", "sales_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "products_organization_id_unit_id_fkey"
            columns: ["organization_id", "unit_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      purchase_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          discount_amount: number
          document_type: string
          id: string
          invoice_date: string
          invoice_number: string
          organization_id: string
          original_invoice_id: string | null
          payable_account_id: string | null
          posted_journal_entry_id: string | null
          status: string
          subtotal: number
          supplier_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          document_type?: string
          id?: string
          invoice_date: string
          invoice_number: string
          organization_id: string
          original_invoice_id?: string | null
          payable_account_id?: string | null
          posted_journal_entry_id?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          document_type?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          organization_id?: string
          original_invoice_id?: string | null
          payable_account_id?: string | null
          posted_journal_entry_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_organization_id_original_invoice_id_fkey"
            columns: ["organization_id", "original_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_invoices_organization_id_payable_account_id_fkey"
            columns: ["organization_id", "payable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_invoices_organization_id_posted_journal_entry_id_fkey"
            columns: ["organization_id", "posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_invoices_organization_id_supplier_id_fkey"
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
          discount_per_unit: number
          id: string
          line_number: number
          line_total: number
          net_unit_cost: number
          organization_id: string
          original_item_id: string | null
          product_id: string
          purchase_invoice_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          discount_per_unit?: number
          id?: string
          line_number: number
          line_total: number
          net_unit_cost: number
          organization_id: string
          original_item_id?: string | null
          product_id: string
          purchase_invoice_id: string
          quantity: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          discount_per_unit?: number
          id?: string
          line_number?: number
          line_total?: number
          net_unit_cost?: number
          organization_id?: string
          original_item_id?: string | null
          product_id?: string
          purchase_invoice_id?: string
          quantity?: number
          unit_cost?: number
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
            foreignKeyName: "purchase_items_organization_id_original_item_id_fkey"
            columns: ["organization_id", "original_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_items_organization_id_product_id_fkey"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "purchase_items_organization_id_purchase_invoice_id_fkey"
            columns: ["organization_id", "purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number
          document_type: string
          id: string
          invoice_date: string
          invoice_number: string
          organization_id: string
          original_invoice_id: string | null
          posted_journal_entry_id: string | null
          receivable_account_id: string | null
          status: string
          subtotal: number
          total_amount: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_amount?: number
          document_type?: string
          id?: string
          invoice_date: string
          invoice_number: string
          organization_id: string
          original_invoice_id?: string | null
          posted_journal_entry_id?: string | null
          receivable_account_id?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_amount?: number
          document_type?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          organization_id?: string
          original_invoice_id?: string | null
          posted_journal_entry_id?: string | null
          receivable_account_id?: string | null
          status?: string
          subtotal?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_organization_id_original_invoice_id_fkey"
            columns: ["organization_id", "original_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_invoices_organization_id_posted_journal_entry_id_fkey"
            columns: ["organization_id", "posted_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_invoices_organization_id_receivable_account_id_fkey"
            columns: ["organization_id", "receivable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      sales_items: {
        Row: {
          cogs_total: number | null
          cogs_unit_cost: number | null
          created_at: string
          discount_per_unit: number
          id: string
          line_number: number
          line_total: number
          net_unit_price: number
          organization_id: string
          original_item_id: string | null
          product_id: string
          quantity: number
          sales_invoice_id: string
          unit_price: number
        }
        Insert: {
          cogs_total?: number | null
          cogs_unit_cost?: number | null
          created_at?: string
          discount_per_unit?: number
          id?: string
          line_number: number
          line_total: number
          net_unit_price: number
          organization_id: string
          original_item_id?: string | null
          product_id: string
          quantity: number
          sales_invoice_id: string
          unit_price: number
        }
        Update: {
          cogs_total?: number | null
          cogs_unit_cost?: number | null
          created_at?: string
          discount_per_unit?: number
          id?: string
          line_number?: number
          line_total?: number
          net_unit_price?: number
          organization_id?: string
          original_item_id?: string | null
          product_id?: string
          quantity?: number
          sales_invoice_id?: string
          unit_price?: number
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
            foreignKeyName: "sales_items_organization_id_original_item_id_fkey"
            columns: ["organization_id", "original_item_id"]
            isOneToOne: false
            referencedRelation: "sales_items"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_items_organization_id_product_id_fkey"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "sales_items_organization_id_sales_invoice_id_fkey"
            columns: ["organization_id", "sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
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
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
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
      post_expense: {
        Args: { p_credit_account_id: string; p_expense_id: string }
        Returns: string
      }
      post_manual_journal: {
        Args: {
          p_description: string
          p_entry_date: string
          p_entry_type?: string
          p_lines: Json
          p_org_id: string
        }
        Returns: string
      }
      post_payment: {
        Args: {
          p_allocations?: Json
          p_payment_id: string
          p_settlement_account_id: string
        }
        Returns: string
      }
      post_purchase_invoice: {
        Args: { p_invoice_id: string; p_payable_account_id: string }
        Returns: string
      }
      post_sales_invoice: {
        Args: { p_invoice_id: string; p_receivable_account_id: string }
        Returns: string
      }
      reverse_journal: {
        Args: {
          p_description?: string
          p_journal_id: string
          p_reversal_date: string
        }
        Returns: string
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
