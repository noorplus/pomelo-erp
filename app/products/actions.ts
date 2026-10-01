"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization, getCurrentUserId } from "@/lib/supabase/organization";

export type ProductActionState = {
  error?: string;
  success?: string;
};

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function databaseMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return "A product with this automatically generated code already exists in this organization.";
  }
  if (error.code === "23503") {
    return "One of the selected units or accounts is invalid for this organization.";
  }
  return error.message || "The product could not be saved.";
}

export async function saveProduct(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const supabase = await createClient();
    const organization = await getCurrentOrganization();
    const userId = await getCurrentUserId();

    const id = value(formData, "id");
    const productCode = value(formData, "product_code");
    const name = value(formData, "name");
    const description = value(formData, "description");
    const unitId = value(formData, "unit_id");
    const inventoryAccountId = value(formData, "inventory_account_id");
    const salesAccountId = value(formData, "sales_account_id");
    const cogsAccountId = value(formData, "cogs_account_id");

    if (!name || !unitId || !inventoryAccountId || !salesAccountId || !cogsAccountId) {
      return { error: "Product code, name, unit, inventory, sales, and COGS accounts are required." };
    }

    const payload = {
      organization_id: organization.id,
      product_code: productCode,
      name,
      description: description || null,
      unit_id: unitId,
      inventory_account_id: inventoryAccountId,
      sales_account_id: salesAccountId,
      cogs_account_id: cogsAccountId,
    };

    if (id) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("organization_id", organization.id)
        .eq("id", id);

      if (error) {
        return { error: databaseMessage(error) };
      }

      revalidatePath("/products");
      revalidatePath("/");
      return { success: "Product updated successfully." };
    }

    const { error } = await supabase.from("products").insert({
      ...payload,
      created_by: userId,
    });

    if (error) {
      return { error: databaseMessage(error) };
    }

    revalidatePath("/products");
    revalidatePath("/");
    return { success: "Product created successfully." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save product.",
    };
  }
}

export async function toggleProduct(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  try {
    const id = value(formData, "id");
    const nextActive = value(formData, "next_active") === "true";

    if (!id) {
      return { error: "Product ID is required." };
    }

    const supabase = await createClient();
    const organization = await getCurrentOrganization();

    const { error } = await supabase
      .from("products")
      .update({ is_active: nextActive })
      .eq("organization_id", organization.id)
      .eq("id", id);

    if (error) {
      return { error: databaseMessage(error) };
    }

    revalidatePath("/products");
    revalidatePath("/");
    return { success: nextActive ? "Product activated." : "Product deactivated." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to change product status.",
    };
  }
}
