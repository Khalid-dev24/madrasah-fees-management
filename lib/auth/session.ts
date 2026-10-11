import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createSupabaseUserClient } from "@/lib/supabase/user";

export type AppSession = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "accountant" | "viewer";
};

export async function getSession(): Promise<AppSession | null> {
  await connection();
  const supabase = await createSupabaseUserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    const message = userError.message.toLowerCase();
    if (
      message.includes("auth session missing") ||
      message.includes("no session") ||
      message.includes("user not found") ||
      message.includes("not authenticated")
    ) {
      return null;
    }
    throw new Error(`Unable to verify Supabase Auth session: ${userError.message}`);
  }
  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    throw new Error(`Unable to load authenticated user profile: ${profileError.message}`);
  }
  if (!profile) {
    throw new Error("Your authenticated user does not have a Madrasah profile.");
  }
  if (
    profile.role !== "admin" &&
    profile.role !== "accountant" &&
    profile.role !== "viewer"
  ) {
    throw new Error("Your Madrasah profile has an unsupported role.");
  }

  return {
    id: profile.id,
    email: profile.email ?? user.email ?? "",
    name: profile.full_name,
    role: profile.role,
  };
}

export async function requireAuth(): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireFinanceUser(): Promise<AppSession> {
  const session = await requireAuth();
  if (session.role !== "admin" && session.role !== "accountant") {
    throw new Error("Your account does not have permission to manage financial records.");
  }
  return session;
}
