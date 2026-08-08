"use server";

import { redirect } from "next/navigation";

import { loginAdmin } from "@/features/admin";

export async function loginAction(formData: FormData) {
  const authenticated = await loginAdmin(formData.get("secret"));
  if (!authenticated) redirect("/admin/login?error=invalid");
  redirect("/admin");
}
