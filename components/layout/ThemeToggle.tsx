"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";
const STORAGE_KEY = "finara-theme";

function resolveCurrentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({
  variant = "icon",
  collapsed = false,
  className,
}: {
  variant?: "icon" | "row";
  collapsed?: boolean;
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Deferred read (not a synchronous effect setState) — the actual theme is already applied
    // pre-hydration by the blocking script in app/layout.tsx; this just syncs this button's icon.
    Promise.resolve().then(() => setTheme(resolveCurrentTheme()));
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const label = theme === "dark" ? "Light Mode" : "Dark Mode";
  const Icon = theme === "dark" ? SunIcon : MoonIcon;

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggle}
        title={collapsed ? label : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-surface-hover hover:text-foreground",
          className,
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-surface-hover hover:text-foreground",
        className,
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
