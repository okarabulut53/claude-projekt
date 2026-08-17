import { auth, currentUser } from "@clerk/nextjs/server";
import { getOrCreateAppUser } from "@/lib/db";
import { AppUser } from "@/lib/types";

export async function requireUserId(): Promise<string> {
  const { userId } = await auth.protect();
  return userId;
}

export async function requireAppUser(): Promise<AppUser> {
  const userId = await requireUserId();
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  return getOrCreateAppUser(userId, email);
}
