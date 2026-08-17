import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-surface px-6 py-16">
      <SignIn />
    </div>
  );
}
