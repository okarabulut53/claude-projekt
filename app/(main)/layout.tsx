import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { requireAppUser } from "@/lib/current-user";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const appUser = await requireAppUser();

  if (!appUser.riskProfile) {
    redirect("/onboarding/whatsapp");
  }

  return <AppShell>{children}</AppShell>;
}
