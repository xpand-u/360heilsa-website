import { redirect } from "next/navigation";

// Legacy single-password login — replaced by Supabase auth at /login
export default function DashboardLogin() {
  redirect("/dashboard");
}
