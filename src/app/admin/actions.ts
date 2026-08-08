"use server";

import { redirect } from "next/navigation";

import { logoutAdmin } from "@/features/admin";

export async function logoutAction() {
  await logoutAdmin();
  redirect("/admin/login");
}
