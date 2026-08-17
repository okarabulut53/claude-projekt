import Link from "next/link";

export function PromoBanner() {
  return (
    <div className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 px-4 py-2.5 text-center text-sm font-medium text-white">
      Jetzt in der Beta-Phase: KI-Investmentanalyse komplett kostenlos.{" "}
      <Link href="#preise" className="underline underline-offset-2 hover:no-underline">
        Mehr erfahren
      </Link>
    </div>
  );
}
