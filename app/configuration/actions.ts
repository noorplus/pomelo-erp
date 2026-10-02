"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/organization";

export type ConfigActionState = { error?: string; success?: string };

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const bool = (formData: FormData, key: string) => formData.get(key) === "true";

function dbMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "A record with the same value already exists.";
  if (error.code === "23503") return "The selected record is invalid or is already referenced by another ERP record.";
  if (error.code === "23514") return "One or more values violate the database business rules.";
  if (error.code === "42501") return "You do not have permission to change this configuration.";
  return error.message || "The configuration could not be saved.";
}

export async function saveUnit(formData: FormData): Promise<ConfigActionState> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrganization();
    const id = value(formData, "id");
    const name = value(formData, "name");
    if (!name) return { error: "Unit name is required." };
    const payload = { organization_id: org.id, name, is_active: bool(formData, "is_active") };
    const result = id
      ? await supabase.from("units_of_measure").update(payload).eq("organization_id", org.id).eq("id", id)
      : await supabase.from("units_of_measure").insert(payload);
    if (result.error) return { error: dbMessage(result.error) };
    revalidatePath("/inventory/configuration/units");
    revalidatePath("/products");
    return { success: id ? "Unit updated." : "Unit created." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to save unit." };
  }
}

export async function toggleUnit(formData: FormData): Promise<ConfigActionState> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrganization();
    const id = value(formData, "id");
    const next = bool(formData, "next_active");
    const { error } = await supabase.from("units_of_measure").update({ is_active: next }).eq("organization_id", org.id).eq("id", id);
    if (error) return { error: dbMessage(error) };
    revalidatePath("/inventory/configuration/units");
    revalidatePath("/products");
    return { success: next ? "Unit activated." : "Unit deactivated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to change unit status." };
  }
}

export async function saveAccount(formData: FormData): Promise<ConfigActionState> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrganization();
    const id = value(formData, "id");
    const accountCode = value(formData, "account_code");
    const accountName = value(formData, "account_name");
    const accountType = value(formData, "account_type");
    const normalBalance = value(formData, "normal_balance");
    const parent = value(formData, "parent_account_id");
    if (!accountCode || !accountName || !accountType || !normalBalance) return { error: "Code, name, type, and normal balance are required." };
    if (!["asset", "liability", "equity", "revenue", "expense"].includes(accountType)) return { error: "Account type is invalid." };
    if (!["debit", "credit"].includes(normalBalance)) return { error: "Normal balance is invalid." };
    if (parent && id === parent) return { error: "An account cannot be its own parent." };
    if (id) {
      const { data: current, error: lookupError } = await supabase.from("accounts").select("is_system_account").eq("organization_id", org.id).eq("id", id).maybeSingle();
      if (lookupError) return { error: dbMessage(lookupError) };
      if (!current) return { error: "The selected account was not found." };
      if (current.is_system_account) return { error: "System accounts are protected and cannot be edited." };
    }
    const payload = {
      organization_id: org.id,
      account_code: accountCode,
      account_name: accountName,
      account_type: accountType,
      normal_balance: normalBalance,
      parent_account_id: parent || null,
      is_control_account: bool(formData, "is_control_account"),
      is_postable: bool(formData, "is_postable"),
      is_active: bool(formData, "is_active"),
    };
    const result = id
      ? await supabase.from("accounts").update(payload).eq("organization_id", org.id).eq("id", id)
      : await supabase.from("accounts").insert(payload);
    if (result.error) return { error: dbMessage(result.error) };
    revalidatePath("/accounting/configuration/accounts");
    revalidatePath("/products");
    revalidatePath("/purchases");
    revalidatePath("/sales");
    revalidatePath("/payments");
    revalidatePath("/expenses");
    return { success: id ? "Account updated." : "Account created." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to save account." };
  }
}

export async function toggleAccount(formData: FormData): Promise<ConfigActionState> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrganization();
    const id = value(formData, "id");
    const next = bool(formData, "next_active");
    const { data: current, error: lookupError } = await supabase.from("accounts").select("is_system_account").eq("organization_id", org.id).eq("id", id).maybeSingle();
    if (lookupError) return { error: dbMessage(lookupError) };
    if (!current) return { error: "The selected account was not found." };
    if (current.is_system_account) return { error: "System accounts are protected and cannot be deactivated." };
    const { error } = await supabase.from("accounts").update({ is_active: next }).eq("organization_id", org.id).eq("id", id);
    if (error) return { error: dbMessage(error) };
    revalidatePath("/accounting/configuration/accounts");
    return { success: next ? "Account activated." : "Account deactivated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to change account status." };
  }
}

export async function savePeriod(formData: FormData): Promise<ConfigActionState> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrganization();
    const id = value(formData, "id");
    const name = value(formData, "name");
    const startDate = value(formData, "start_date");
    const endDate = value(formData, "end_date");
    if (!name || !startDate || !endDate) return { error: "Name, start date, and end date are required." };
    if (startDate > endDate) return { error: "Start date must be on or before end date." };
    const payload = { organization_id: org.id, name, start_date: startDate, end_date: endDate };
    if (id) {
      const { data: current, error: lookupError } = await supabase.from("accounting_periods").select("status").eq("organization_id", org.id).eq("id", id).maybeSingle();
      if (lookupError) return { error: dbMessage(lookupError) };
      if (!current) return { error: "The selected accounting period was not found." };
      if (current.status === "closed") return { error: "Closed accounting periods are immutable and cannot be edited." };
    }
    const result = id
      ? await supabase.from("accounting_periods").update(payload).eq("organization_id", org.id).eq("id", id)
      : await supabase.from("accounting_periods").insert(payload);
    if (result.error) return { error: dbMessage(result.error) };
    revalidatePath("/accounting/configuration/periods");
    revalidatePath("/accounting");
    return { success: id ? "Accounting period updated." : "Accounting period created." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to save accounting period." };
  }
}

export async function togglePeriod(formData: FormData): Promise<ConfigActionState> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrganization();
    const id = value(formData, "id");
    const next = bool(formData, "next_open");
    if (next) return { error: "Closed accounting periods cannot be reopened." };
    const { data: current, error: lookupError } = await supabase.from("accounting_periods").select("status").eq("organization_id", org.id).eq("id", id).maybeSingle();
    if (lookupError) return { error: dbMessage(lookupError) };
    if (!current) return { error: "The selected accounting period was not found." };
    if (current.status === "closed") return { error: "The accounting period is already closed." };
    const { error } = await supabase.from("accounting_periods").update({ status: "closed" }).eq("organization_id", org.id).eq("id", id);
    if (error) return { error: dbMessage(error) };
    revalidatePath("/accounting/configuration/periods");
    revalidatePath("/accounting");
    return { success: next ? "Period opened." : "Period closed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to change period status." };
  }
}

export async function saveExpenseCategory(formData: FormData): Promise<ConfigActionState> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrganization();
    const id = value(formData, "id");
    const categoryCode = value(formData, "category_code");
    const name = value(formData, "name");
    const accountId = value(formData, "expense_account_id");
    if (!categoryCode || !name || !accountId) return { error: "Code, name, and expense account are required." };
    const payload = { organization_id: org.id, category_code: categoryCode, name, expense_account_id: accountId, is_active: bool(formData, "is_active") };
    const result = id
      ? await supabase.from("expense_categories").update(payload).eq("organization_id", org.id).eq("id", id)
      : await supabase.from("expense_categories").insert(payload);
    if (result.error) return { error: dbMessage(result.error) };
    revalidatePath("/expenses/configuration/categories");
    revalidatePath("/expenses");
    return { success: id ? "Expense category updated." : "Expense category created." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to save expense category." };
  }
}

export async function toggleExpenseCategory(formData: FormData): Promise<ConfigActionState> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrganization();
    const id = value(formData, "id");
    const next = bool(formData, "next_active");
    const { error } = await supabase.from("expense_categories").update({ is_active: next }).eq("organization_id", org.id).eq("id", id);
    if (error) return { error: dbMessage(error) };
    revalidatePath("/expenses/configuration/categories");
    revalidatePath("/expenses");
    return { success: next ? "Category activated." : "Category deactivated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to change category status." };
  }
}

export async function saveNumberSequence(formData: FormData): Promise<ConfigActionState> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrganization();
    const id = value(formData, "id");
    const prefix = String(formData.get("prefix") ?? "").trim();
    const nextNumber = Number(formData.get("next_number") ?? 0);
    const padding = Number(formData.get("padding") ?? 0);
    if (!id) return { error: "A sequence record is required." };
    if (!Number.isInteger(nextNumber) || nextNumber < 1) return { error: "Next number must be a positive whole number." };
    if (!Number.isInteger(padding) || padding < 1 || padding > 12) return { error: "Padding must be a whole number from 1 to 12." };
    const { data: current, error: lookupError } = await supabase.from("number_sequences").select("next_number,is_active").eq("organization_id", org.id).eq("id", id).maybeSingle();
    if (lookupError) return { error: dbMessage(lookupError) };
    if (!current) return { error: "The selected number sequence was not found." };
    if (nextNumber < Number(current.next_number)) return { error: "Next number cannot be moved backwards because it may reuse an existing document number." };
    const { error } = await supabase
      .from("number_sequences")
      .update({
        prefix,
        next_number: nextNumber,
        padding,
        is_active: current.is_active,
      })
      .eq("organization_id", org.id)
      .eq("id", id);
    if (error) return { error: dbMessage(error) };
    revalidatePath("/settings/number-sequences");
    revalidatePath("/products");
    revalidatePath("/contacts");
    revalidatePath("/purchases");
    revalidatePath("/sales");
    revalidatePath("/expenses");
    revalidatePath("/payments");
    revalidatePath("/accounting");
    return { success: "Number sequence updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to save number sequence." };
  }
}

export async function saveOrganization(formData: FormData): Promise<ConfigActionState> {
  try {
    const supabase = await createClient();
    const org = await getCurrentOrganization();
    const name = value(formData, "name");
    const email = value(formData, "email");
    if (!name) return { error: "Organization name is required." };
    const { error } = await supabase.from("organizations").update({
      name,
      phone: value(formData, "phone") || null,
      email: email || null,
      address: value(formData, "address") || null,
      city: value(formData, "city") || null,
      country: value(formData, "country") || null,
      base_currency: value(formData, "base_currency").toUpperCase(),
      timezone: value(formData, "timezone"),
      logo_url: value(formData, "logo_url") || null,
      tax_number: value(formData, "tax_number") || null,
    }).eq("id", org.id);
    if (error) return { error: dbMessage(error) };
    revalidatePath("/settings");
    revalidatePath("/");
    return { success: "Organization settings updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unable to save organization settings." };
  }
}
