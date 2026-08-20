import { BookmarkIcon } from "@/components/icons/Icons";
import { parseStructuredMessage } from "./structuredMessage";

export interface ExportReady {
  type: "export_ready";
  instrument: string;
  typ: string;
  format: "csv" | "docx" | "pptx";
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

export function parseExportReady(content: string): ExportReady | null {
  const parsed = parseStructuredMessage(content) as Partial<ExportReady> | null;
  if (parsed && parsed.type === "export_ready" && typeof parsed.dataUrl === "string") {
    return parsed as ExportReady;
  }
  return null;
}

const formatLabels: Record<ExportReady["format"], string> = {
  csv: "CSV",
  docx: "Word-Dokument",
  pptx: "PowerPoint-Präsentation",
};

export function ExportReadyCard({ file }: { file: ExportReady }) {
  return (
    <div className="max-w-[90%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
          <BookmarkIcon className="h-3.5 w-3.5" />
        </span>
        Export bereit
      </div>

      <p className="text-sm text-foreground/80">
        {file.instrument} · {file.typ} als {formatLabels[file.format]}
      </p>

      <a
        href={file.dataUrl}
        download={file.fileName}
        className="mt-3 inline-flex items-center justify-center rounded-full bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal/90"
      >
        {file.fileName} herunterladen
      </a>
    </div>
  );
}
