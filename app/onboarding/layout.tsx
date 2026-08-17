import { requireAppUser } from "@/lib/current-user";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireAppUser();
  return <>{children}</>;
}
