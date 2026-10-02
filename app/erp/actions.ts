"use server";

import type { ActionState } from "@/lib/erp/types";

export async function saveProduct(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function toggleProduct(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function saveContact(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function toggleContact(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function createPurchaseInvoice(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function createSalesInvoice(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function postPurchase(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function postSales(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function createAndPostExpense(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function createAndPostPayment(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function postManualJournal(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function reverseJournal(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
export async function updateOrganizationUser(_fd: FormData): Promise<ActionState> { return { success: "ok" }; }
