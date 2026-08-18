"use client";

import { ReactNode, useRef } from "react";
import { cn } from "@/lib/cn";

/** Thin draggable divider between two flex columns — hand-rolled (no resizable-panel
 *  dependency exists in this project) via raw Pointer Events, matching the codebase's general
 *  no-dependency-UI convention. Pure resize primitive; an optional collapse-toggle button for
 *  an adjacent panel is supplied by the caller via `collapseButton` rather than built in here,
 *  so this component doesn't need to know which direction a chevron should point. */
export function ResizeHandle({
  onResize,
  disabled = false,
  collapseButtons,
}: {
  /** Called with the pointer's horizontal movement in px since the last event (not the total drag distance). */
  onResize: (deltaPx: number) => void;
  disabled?: boolean;
  /** One button per adjacent panel this divider can collapse (a divider between two collapsible
   *  panels gets two, stacked). Each button owns only its own click handling — positioning within
   *  the divider is this component's job so buttons stack cleanly instead of fighting over the
   *  same absolute center. */
  collapseButtons?: ReactNode[];
}) {
  const lastXRef = useRef(0);

  function onPointerDown(e: React.PointerEvent) {
    if (disabled) return;
    lastXRef.current = e.clientX;

    function onMove(ev: PointerEvent) {
      const delta = ev.clientX - lastXRef.current;
      lastXRef.current = ev.clientX;
      onResize(delta);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      className={cn(
        "group relative w-1.5 shrink-0 border-x border-brand-border bg-surface",
        !disabled && "cursor-col-resize hover:bg-brand-teal/20",
      )}
    >
      {collapseButtons && collapseButtons.length > 0 && (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-8">
          {collapseButtons.map((button, i) => (
            // Stops the collapse button's own click from also registering as a (near-zero, but
            // still state-touching) resize drag on the parent divider.
            <span key={i} onPointerDown={(e) => e.stopPropagation()}>
              {button}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
