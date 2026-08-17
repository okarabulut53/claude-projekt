import Link from "next/link";
import { cn } from "@/lib/cn";

export function DisclaimerNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-foreground/40", className)}>
      Keine Anlageberatung, keine Kauf- oder Verkaufsempfehlung. Kapitalanlagen sind mit Risiken
      bis hin zum Totalverlust verbunden.{" "}
      <Link href="/rechtliches" className="underline hover:text-foreground/60">
        Rechtliche Hinweise
      </Link>
      .
    </p>
  );
}
