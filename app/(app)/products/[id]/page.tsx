import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicationContext } from "@/lib/organizations/server";
import { getProductDetails } from "@/lib/products/queries";
import { ProductDetail } from "@/components/products/product-detail";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getApplicationContext();
  if (!context.activeOrganization) return null;
  const details = await getProductDetails(await createClient(), context.activeOrganization.id, (await params).id);
  if (!details) notFound();
  return <ProductDetail {...details} />;
}