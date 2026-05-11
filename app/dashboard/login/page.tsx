import { redirect } from "next/navigation";

// Legacy route — send to login page
export default function DashboardLogin() {
  redirect("/login");
}
