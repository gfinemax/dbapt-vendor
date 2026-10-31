import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().replace(/[,%()]/g, " ").slice(0, 60) ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해." }, { status: 401 });
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const [vendorsResult, contactsResult, projectsResult, meetingsResult] = await Promise.all([
    (safeView ? supabase.from("vendors_public") : supabase.from("vendors")).select("id,name").ilike("name", `%${query}%`).limit(5),
    supabase.from("vendor_contacts").select("id,vendor_id,name,title").ilike("name", `%${query}%`).is("deleted_at", null).limit(5),
    (safeView ? supabase.from("projects_public") : supabase.from("projects")).select("id,title").ilike("title", `%${query}%`).limit(5),
    supabase.from("meetings").select("id,agenda").or(`agenda.ilike.%${query}%,notes.ilike.%${query}%,decisions.ilike.%${query}%`).is("deleted_at", null).limit(5),
  ]);
  const vendorIds = [...new Set((contactsResult.data ?? []).map((contact) => contact.vendor_id))];
  const contactVendors = safeView
    ? await supabase.from("vendors_public").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
    : await supabase.from("vendors").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null);
  const vendorMap = new Map((contactVendors.data ?? []).flatMap((vendor) => vendor.id && vendor.name ? [[vendor.id, vendor.name]] : []));
  const results = [
    ...(vendorsResult.data ?? []).flatMap((vendor) => vendor.id && vendor.name ? [{ id: `vendor-${vendor.id}`, kind: "업체", title: vendor.name, description: "용역사", href: `/vendors/${vendor.id}` }] : []),
    ...(contactsResult.data ?? []).map((contact) => ({ id: `contact-${contact.id}`, kind: "담당자", title: contact.name, description: `${vendorMap.get(contact.vendor_id) ?? "업체"}${contact.title ? ` · ${contact.title}` : ""}`, href: `/vendors/${contact.vendor_id}` })),
    ...(projectsResult.data ?? []).flatMap((project) => project.id && project.title ? [{ id: `project-${project.id}`, kind: "용역", title: project.title, description: "용역 건", href: `/projects/${project.id}` }] : []),
    ...(meetingsResult.data ?? []).map((meeting) => ({ id: `meeting-${meeting.id}`, kind: "협의", title: meeting.agenda, description: "협의록", href: `/meetings/${meeting.id}` })),
  ];
  return NextResponse.json({ results });
}
