import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { SearchBox } from "@/components/layout/SearchBox";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/chat", label: "Chatbot" },
  { href: "/settings", label: "Einstellungen" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-surface">
      <header className="sticky top-0 z-40 border-b border-brand-border bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-brand-navy">
            finara
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-brand-surface hover:text-brand-navy"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1">
            <SearchBox />
          </div>
          <UserButton />
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-brand-border px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-brand-surface hover:text-brand-navy"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
