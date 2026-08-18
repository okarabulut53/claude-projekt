"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { SearchBox } from "@/components/layout/SearchBox";
import { AppSidebar, mobileNavItems } from "@/components/layout/AppSidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/cn";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = pathname.startsWith("/finaraai");

  return (
    <div className={cn("flex bg-brand-surface", fullBleed ? "h-screen overflow-hidden" : "min-h-screen")}>
      <AppSidebar />
      <div className={cn("flex flex-1 flex-col", fullBleed ? "h-screen min-h-0 overflow-hidden" : "min-h-screen")}>
        <header className="sticky top-0 z-40 shrink-0 border-b border-brand-border bg-surface">
          <div className="flex h-16 items-center gap-6 px-4 md:px-6">
            <Link href="/dashboard" className="text-lg font-bold tracking-tight text-foreground md:hidden">
              finara
            </Link>
            <div className="flex-1">
              <SearchBox />
            </div>
            <ThemeToggle className="md:hidden" />
            <UserButton />
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto border-t border-brand-border px-4 py-2 md:hidden">
            {mobileNavItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-brand-teal-light text-brand-teal"
                      : "text-foreground/70 hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/erste-schritte"
              aria-current={isActivePath(pathname, "/erste-schritte") ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActivePath(pathname, "/erste-schritte")
                  ? "bg-brand-teal-light text-brand-teal"
                  : "text-foreground/70 hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              Erste Schritte
            </Link>
          </nav>
        </header>
        <main className={fullBleed ? "min-h-0 flex-1 overflow-hidden" : "mx-auto w-full max-w-7xl flex-1 px-6 py-10"}>
          {children}
        </main>
      </div>
    </div>
  );
}
