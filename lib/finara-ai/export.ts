import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import PptxGenJS from "pptxgenjs";
import { ExportableAnalysis } from "./exportData";

const DISCLAIMER =
  "Dies ist eine statistische Einschätzung basierend auf aktuellen Daten, keine Anlageberatung und keine Erfolgsgarantie.";

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Hand-rolled instead of a csv-writer/json2csv dependency — a handful of quoted columns doesn't
 *  warrant a library (same no-dependency-for-simple-things stance as the hand-rolled SVG charts). */
export function exportToCsv(analysis: ExportableAnalysis): Buffer {
  const header = ["Faktor", "Wert", "Score", "Begründung"];
  const lines = [header, ...analysis.rows.map((r) => [r.faktor, r.wert, r.score, r.begruendung])].map((cols) =>
    cols.map(csvEscape).join(","),
  );
  // Leading BOM so Excel on a German locale opens UTF-8 umlauts correctly instead of mangling them.
  return Buffer.from(`﻿${lines.join("\r\n")}`, "utf-8");
}

export async function exportToDocx(analysis: ExportableAnalysis): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: `${analysis.instrument} — ${analysis.typ}`, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: new Date(analysis.datum).toLocaleDateString("de-DE"), spacing: { after: 200 } }),
  ];

  if (analysis.gesamtscore) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Gesamtscore: ", bold: true }),
          new TextRun(`${analysis.gesamtscore}${analysis.konfidenz ? ` · Konfidenz: ${analysis.konfidenz}` : ""}`),
        ],
        spacing: { after: 200 },
      }),
    );
  }

  if (analysis.rows.length > 0) {
    children.push(new Paragraph({ text: "Kennzahlen", heading: HeadingLevel.HEADING_1 }));
    const headerCells = ["Faktor", "Wert", "Score", "Begründung"].map(
      (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] }),
    );
    const dataRows = analysis.rows.map(
      (r) =>
        new TableRow({
          children: [r.faktor, r.wert, r.score, r.begruendung].map((v) => new TableCell({ children: [new Paragraph(v)] })),
        }),
    );
    children.push(new Table({ rows: [new TableRow({ children: headerCells }), ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
  }

  for (const [label, text] of [
    ["Bull Case", analysis.bullCase],
    ["Base Case", analysis.baseCase],
    ["Bear Case", analysis.bearCase],
  ] as const) {
    if (!text) continue;
    children.push(new Paragraph({ text: label, heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph(text));
  }

  if (analysis.summary) {
    children.push(new Paragraph({ text: "Fazit", heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph(analysis.summary));
  }

  children.push(new Paragraph({ text: "", spacing: { before: 300 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: DISCLAIMER, italics: true, size: 18 })] }));

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

export async function exportToPptx(analysis: ExportableAnalysis): Promise<Buffer> {
  const pptx = new PptxGenJS();

  const title = pptx.addSlide();
  title.addText(analysis.instrument, { x: 0.5, y: 1.4, w: 9, h: 1, fontSize: 32, bold: true });
  title.addText(analysis.typ, { x: 0.5, y: 2.3, w: 9, h: 0.6, fontSize: 18, color: "666666" });
  title.addText(new Date(analysis.datum).toLocaleDateString("de-DE"), { x: 0.5, y: 2.9, w: 9, h: 0.5, fontSize: 12, color: "999999" });
  if (analysis.gesamtscore) {
    title.addText(`Gesamtscore: ${analysis.gesamtscore}${analysis.konfidenz ? ` (Konfidenz: ${analysis.konfidenz})` : ""}`, {
      x: 0.5,
      y: 3.6,
      w: 9,
      h: 0.5,
      fontSize: 14,
      bold: true,
    });
  }

  if (analysis.rows.length > 0) {
    const slide = pptx.addSlide();
    slide.addText("Kennzahlen", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true });
    const tableRows: PptxGenJS.TableRow[] = [
      ["Faktor", "Wert", "Score", "Begründung"].map((h) => ({ text: h, options: { bold: true } })),
      ...analysis.rows.map((r) => [r.faktor, r.wert, r.score, r.begruendung].map((text) => ({ text }))),
    ];
    slide.addTable(tableRows, { x: 0.4, y: 1, w: 9.2, fontSize: 10, autoPage: true, autoPageCharWeight: -1 });
  }

  const hasScenarios = analysis.bullCase || analysis.baseCase || analysis.bearCase;
  if (hasScenarios) {
    const slide = pptx.addSlide();
    slide.addText("Bull / Base / Bear Case", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true });
    let y = 1.1;
    for (const [label, text] of [
      ["Bull Case", analysis.bullCase],
      ["Base Case", analysis.baseCase],
      ["Bear Case", analysis.bearCase],
    ] as const) {
      if (!text) continue;
      slide.addText(label, { x: 0.5, y, w: 9, h: 0.4, fontSize: 16, bold: true });
      y += 0.45;
      slide.addText(text, { x: 0.5, y, w: 9, h: 1.2, fontSize: 12 });
      y += 1.4;
    }
  }

  const closing = pptx.addSlide();
  if (analysis.summary) {
    closing.addText("Fazit", { x: 0.5, y: 1.2, w: 9, h: 0.6, fontSize: 20, bold: true });
    closing.addText(analysis.summary, { x: 0.5, y: 1.9, w: 9, h: 1.5, fontSize: 14 });
  }
  closing.addText(DISCLAIMER, { x: 0.5, y: 3.8, w: 9, h: 1.2, fontSize: 12, italic: true, align: "center", color: "666666" });

  const output = await pptx.write({ outputType: "nodebuffer" });
  return output as Buffer;
}
