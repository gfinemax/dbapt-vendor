import { VendorDirectory, type VendorDirectoryRow } from "@/components/vendors/vendor-directory";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const vendorQuery = role === "agent" || role === "viewer"
    ? supabase.from("vendors_public").select("id,name,biz_no,ceo,category,status,address").order("name")
    : supabase.from("vendors").select("id,name,biz_no,ceo,category,status,address").is("deleted_at", null).order("name");
  const [{ data: vendors, error }, { data: contacts }] = await Promise.all([
    vendorQuery,
    supabase.from("vendor_contacts").select("vendor_id,name,is_primary,active").is("deleted_at", null).eq("active", true),
  ]);

  if (error) throw new Error(`업체 목록을 불러오지 못했어: ${error.message}`);

  const rows: VendorDirectoryRow[] = (vendors ?? []).flatMap((vendor) => {
    if (!vendor.id || !vendor.name || !vendor.status) return [];
    const vendorContacts = (contacts ?? [])
      .filter((contact) => contact.vendor_id === vendor.id)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
    return [{
      id: vendor.id,
      name: vendor.name,
      bizNo: vendor.biz_no,
      ceo: vendor.ceo,
      category: vendor.category,
      status: vendor.status,
      address: vendor.address,
      contactNames: vendorContacts.map((contact) => contact.name),
      contactCount: vendorContacts.length,
    }];
  });

  return <VendorDirectory canCreate={role === "admin" || role === "staff"} rows={rows} />;
}
