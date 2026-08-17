import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-surface px-6 py-16">
      <SignUp />
    </div>
  );
}
