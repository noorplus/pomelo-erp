"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/organization";

export type UnitActionState = { error?: string; success?: string };

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function databaseMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "A unit with this name already exists in this organization.";
  if (error.code === "23503") return "This unit is referenced by existing product data and cannot be removed.";
  if (error.code === "42501") return "You do not have permission to change units of measure.";
  return error.message || "The unit could not be saved.";
}

export async function saveUnit(
  _previousState: UnitActionState,
  formData: FormData,
): Promise<UnitActionState> {
  try {
    const supabase = await createClient();
    const organization = await getCurrentOrganization();

    const id = value(formData, "id");
    const code = value(formData, "code").toUpperCase();
    const name = value(formData, "name");
    const symbol = value(formData, "symbol");

    if (!code || !name) {
      return { error: "Unit code and unit name are required." };
    }
    if (code.length > 30) return { error: "Unit code must be 30 characters or fewer." };
    if (name.length > 100) return { error: "Unit name must be 100 characters or fewer." };
    if (symbol.length > 20) return { error: "Unit symbol must be 20 characters or fewer." };

    const payload = {
      organization_id: organization.id,
      code,
      name,
      symbol: symbol || null,
    };

    const result = id
      ? await supabase.from("units_of_measure").update(payload).eq("organization_id", organization.id).eq("id", id)
      : await supabase.from("units_of_measure").insert(payload);

    if (result.error) return { error: databaseMessage(result.error) };

    revalidatePath("/settings");
    revalidatePath("/settings/units");
    revalidatePath("/products");
    return { success: id ? "Unit updated successfully." : "Unit created successfully." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save unit." };
  }
}

export async function toggleUnit(
  _previousState: UnitActionState,
  formData: FormData,
): Promise<UnitActionState> {
  try {
    const supabase = await createClient();
    const organization = await getCurrentOrganization();
    const id = value(formData, "id");
    const nextActive = value(formData, "next_active") === "true";

    if (!id) return { error: "Unit ID is required." };

    const { error } = await supabase
      .from("units_of_measure")
      .update({ is_active: nextActive })
      .eq("organization_id", organization.id)
      .eq("id", id);

    if (error) return { error: databaseMessage(error) };

    revalidatePath("/settings");
    revalidatePath("/settings/units");
    revalidatePath("/products");
    return { success: nextActive ? "Unit activated." : "Unit deactivated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to change unit status." };
  }
}
