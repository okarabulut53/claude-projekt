"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

const sectionLinks = [
  { id: "funktionen", label: "Funktionen" },
  { id: "scoring", label: "AI Score" },
  { id: "preise", label: "Preise" },
];

const linkBase = "text-sm font-medium transition-colors";
const linkInactive = "text-foreground/70 hover:text-brand-navy";
const linkActive = "text-brand-teal";

export function PublicHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (!isHome) return;

    const elements = sectionLinks
      .map((link) => document.getElementById(link.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isHome]);

  const isRechtlichesActive = pathname === "/rechtliches";

  return (
    <header className="sticky top-0 z-40 border-b border-brand-border bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight text-brand-navy">
          finara
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {sectionLinks.map((link) => {
            const active = isHome && activeSection === link.id;
            return (
              <Link
                key={link.id}
                href={`/#${link.id}`}
                aria-current={active ? "true" : undefined}
                className={`${linkBase} ${active ? linkActive : linkInactive}`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/rechtliches"
            aria-current={isRechtlichesActive ? "page" : undefined}
            className={`${linkBase} ${isRechtlichesActive ? linkActive : linkInactive}`}
          >
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
