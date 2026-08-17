import { ReactNode } from "react";

export function IconTile({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "navy" }) {
  const toneClasses =
    tone === "teal" ? "bg-brand-teal-light text-brand-teal" : "bg-white/10 text-brand-teal";
  return (
    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${toneClasses}`}>
      <div className="h-6 w-6">{children}</div>
    </div>
  );
}
