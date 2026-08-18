import { PortfolioPosition } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { ChangeBadge } from "@/components/ui/Badge";
import { removePosition } from "@/lib/actions/portfolio";

export function PositionsTable({ positions }: { positions: PortfolioPosition[] }) {
  if (positions.length === 0) {
    return (
      <p className="text-sm text-foreground/60">
        Noch keine Positionen erfasst. Füge unten deine erste Position hinzu.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-border text-left text-xs text-foreground/50">
            <th className="pb-2 font-medium">Position</th>
            <th className="pb-2 font-medium">Menge</th>
            <th className="pb-2 font-medium">Einstandspreis</th>
            <th className="pb-2 font-medium">Aktueller Preis</th>
            <th className="pb-2 font-medium">Wert</th>
            <th className="pb-2 font-medium">Gewinn/Verlust</th>
            <th className="pb-2 font-medium">Quelle</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const value = position.quantity * position.currentPrice;
            const cost = position.quantity * position.avgPrice;
            const gainAbs = value - cost;
            const gainPct = cost > 0 ? (gainAbs / cost) * 100 : 0;
            return (
              <tr key={position.id} className="border-b border-brand-border last:border-0">
                <td className="py-3">
                  <div className="font-semibold text-foreground">{position.name}</div>
                  <div className="text-xs text-foreground/50">
                    {position.symbol} · {position.assetClass.toUpperCase()}
                  </div>
                </td>
                <td className="py-3">{formatNumber(position.quantity)}</td>
                <td className="py-3">{formatCurrency(position.avgPrice)}</td>
                <td className="py-3">{formatCurrency(position.currentPrice)}</td>
                <td className="py-3 font-medium">{formatCurrency(value)}</td>
                <td className="py-3">
                  <div className={gainAbs >= 0 ? "text-risk-low" : "text-risk-high"}>
                    {formatCurrency(gainAbs)}
                  </div>
                  <ChangeBadge value={gainPct} />
                </td>
                <td className="py-3 text-xs text-foreground/50">
                  {position.source === "manual" ? "Manuell" : "Depot"}
                </td>
                <td className="py-3 text-right">
                  {position.source === "manual" && (
                    <form action={removePosition}>
                      <input type="hidden" name="positionId" value={position.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-foreground/40 hover:text-risk-high"
                      >
                        Entfernen
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
