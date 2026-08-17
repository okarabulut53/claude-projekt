import { addPosition } from "@/lib/actions/portfolio";
import { Button } from "@/components/ui/Button";

export function AddPositionForm() {
  return (
    <form action={addPosition} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      <div className="lg:col-span-1">
        <label className="text-xs font-medium text-foreground/60">Symbol</label>
        <input
          name="symbol"
          required
          placeholder="z. B. SAP"
          className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
      </div>
      <div className="lg:col-span-2">
        <label className="text-xs font-medium text-foreground/60">Name</label>
        <input
          name="name"
          required
          placeholder="z. B. SAP SE"
          className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground/60">Anlageklasse</label>
        <select
          name="assetClass"
          className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-teal"
        >
          <option value="stock">Aktie</option>
          <option value="etf">ETF</option>
          <option value="crypto">Krypto</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-foreground/60">Menge</label>
        <input
          name="quantity"
          type="number"
          step="any"
          min="0"
          required
          className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground/60">Einstandspreis (€)</label>
        <input
          name="avgPrice"
          type="number"
          step="any"
          min="0"
          required
          className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-teal"
        />
      </div>
      <div className="flex items-end lg:col-span-6">
        <Button type="submit">Position hinzufügen</Button>
      </div>
    </form>
  );
}
