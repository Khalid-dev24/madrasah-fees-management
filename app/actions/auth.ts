"use server";

import { redirect } from "next/navigation";

import { createSupabaseUserClient } from "@/lib/supabase/user";

export async function login(_previousState: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return "Enter both your email and password.";
  }

  const supabase = await createSupabaseUserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return "Unable to sign in with those credentials. Check your email and password.";
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw new Error(`User has no role profile and sign out failed: ${signOutError.message}`);
    }
    return profileError
      ? `Unable to load your Madrasah profile: ${profileError.message}`
      : "Your account is not configured with a Madrasah profile. Contact the administrator.";
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createSupabaseUserClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(`Unable to sign out: ${error.message}`);
  }
  redirect("/login");
}
