"use server";

export async function debugAction(_fd: FormData): Promise<{success:string}> {
  return { success: "ok" };
}
