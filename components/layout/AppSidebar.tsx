"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  BookmarkIcon,
  ChartLineIcon,
  ChatBubbleIcon,
  CoinsIcon,
  PanelCollapseIcon,
  RocketIcon,
  SlidersIcon,
} from "@/components/icons/Icons";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/finaraai", label: "FinaraAI", icon: ChatBubbleIcon },
  { href: "/dashboard", label: "Dashboard", icon: ChartLineIcon },
  { href: "/portfolio", label: "Portfolio", icon: CoinsIcon },
  { href: "/watchlist", label: "Watchlisten", icon: BookmarkIcon },
  { href: "/settings", label: "Einstellungen", icon: SlidersIcon },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  function toggle() {
    setCollapsed((prev) => !prev);
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-brand-border bg-surface transition-[width] duration-150 md:flex",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-brand-border px-4">
        {!collapsed && (
          <Link href="/dashboard" className="text-lg font-bold tracking-tight text-foreground">
            finara
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Menü ausklappen" : "Menü einklappen"}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-foreground/50 hover:bg-surface-hover hover:text-foreground"
        >
          <PanelCollapseIcon className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-teal-light text-brand-teal"
                  : "text-foreground/70 hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-brand-border p-3">
        <Link
          href="/erste-schritte"
          aria-current={isActivePath(pathname, "/erste-schritte") ? "page" : undefined}
          title={collapsed ? "Erste Schritte" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActivePath(pathname, "/erste-schritte")
              ? "bg-brand-teal-light text-brand-teal"
              : "text-foreground/70 hover:bg-surface-hover hover:text-foreground",
          )}
        >
          <RocketIcon className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="truncate">Erste Schritte</span>}
        </Link>
        <ThemeToggle variant="row" collapsed={collapsed} />
      </div>
    </aside>
  );
}

export const mobileNavItems = navItems;
