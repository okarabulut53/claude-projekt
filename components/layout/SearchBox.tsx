"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-sm">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Aktie, ETF, Krypto oder ISIN suchen…"
        className="w-full rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-sm outline-none focus:border-brand-teal"
      />
    </form>
  );
}
