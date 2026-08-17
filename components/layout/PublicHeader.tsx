import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-brand-border bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight text-brand-navy">
          finara
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-foreground/70 md:flex">
          <Link href="/#funktionen" className="hover:text-brand-navy">
            Funktionen
          </Link>
          <Link href="/#scoring" className="hover:text-brand-navy">
            AI Score
          </Link>
          <Link href="/#preise" className="hover:text-brand-navy">
            Preise
          </Link>
          <Link href="/rechtliches" className="hover:text-brand-navy">
            Rechtliches
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton>
              <button className="text-sm font-semibold text-brand-navy hover:opacity-70">
                Anmelden
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="inline-flex items-center justify-center rounded-full bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-teal/90">
                Kostenlos starten
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <ButtonLink href="/dashboard" variant="ghost">
              Zum Dashboard
            </ButtonLink>
            <UserButton />
          </Show>
        </div>
      </Container>
    </header>
  );
}
