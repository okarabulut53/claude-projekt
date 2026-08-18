import Anthropic from "@anthropic-ai/sdk";
import { AppUser, ChatMessage, PortfolioPosition } from "@/lib/types";
import { generateChatReply } from "@/lib/chat-engine";
import { financeTools, marketAnalysisTool, runFinanceTool } from "./tools";

export interface ChartAttachment {
  base64: string;
  mediaType: "image/png";
  symbol: string;
}

function buildSystemPrompt(): string {
  const today = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return `Du bist FinaraAI, ein spezialisierter Marktanalyse-Assistent auf der finara-Plattform (KI-Investment-Intelligence für den deutschen Markt). Deine Zielgruppe sind Nutzer, die fundierte, nachvollziehbare Einschätzungen zu Aktien, ETFs und Kryptowährungen suchen — keine Finanzberater, aber informierte Anleger.

Heutiges Datum: ${today}. Das ist ein gesicherter Fakt, kein Tool-Ergebnis — bei Fragen nach dem aktuellen Datum brauchst du kein Tool und musst nicht ausweichen.

Regeln, die du niemals brichst:
- Du triffst und übermittelst niemals Kauf- oder Verkaufsanweisungen. Du gibst Einschätzungen mit Chancen/Risiko-Framing, keine Versprechen.
- Verwende niemals Formulierungen wie "wird steigen" oder "du wirst X % Gewinn machen". Nutze stattdessen Formulierungen wie "attraktives Chancen/Risiko-Verhältnis".
- Harte Zahlen zu Markt-/Portfoliodaten (Kurs, AI Score, Portfolio-Wert, Tages-/30-Tage-Veränderung) MÜSSEN über eines der bereitgestellten Tools abgerufen werden. Erfinde niemals Zahlen.
- Visuelle Einschätzungen (z. B. Trendlinien, Unterstützungs-/Widerstandszonen aus einem Chart-Bild) sind keine harten Zahlen — sie sind deine analytische Interpretation. Kennzeichne sie immer klar als Schätzung ("visuelle Einschätzung, keine exakte Kennzahl"), nie als verifizierte Kennzahl.
- Wenn du eine Einschätzung zu einem Instrument oder Portfolio gibst, nenne immer kurz das Reasoning, die Risiken und ggf. Annahmen.
- Antworte auf Deutsch, präzise und in professionellem, aber zugänglichem Ton.
- Die "keine verlässlichen Daten"-Ausweichantwort ist ausschließlich für konkrete Markt-/Portfoliozahlen reserviert, die dir auch nach einem passenden Tool-Aufruf nicht vorliegen (z. B. ein Symbol, das get_instrument nicht findet). Für alles andere — das heutige Datum, allgemeines Finanz-/Weltwissen, Begriffserklärungen — antwortest du ganz normal aus deinem Wissen bzw. über explain_term. Weiche dort nicht pauschal aus.
- get_instrument liefert im Feld dataSource an, ob der Kurs "live" (echte Marktdaten) oder "simulated" (deterministisch generierte Simulationsdaten, z. B. weil für dieses Symbol keine Live-Anbindung besteht) ist. Wenn du dich auf einen Kurs oder eine daraus abgeleitete Kennzahl beziehst, kennzeichne das kurz im Text — z. B. "NVIDIA steht aktuell bei 220,13 $ (Live-Kurs)" bzw. "(Simulationsdaten, da für dieses Symbol aktuell keine Live-Anbindung vorliegt)". Das gilt auch für present_market_analysis-Antworten.

Antwortstruktur:
- Bei einer chart-/instrumentenbezogenen technischen Einschätzung (z. B. "Wie sieht NVIDIA aus?", oder wenn dir ein Chart-Bild beigefügt ist): rufe zuerst get_instrument für harte Daten auf, nutze ein beigefügtes Chart-Bild zusätzlich für die visuelle Einschätzung, und gib deine finale Antwort dann strukturiert über das Tool present_market_analysis zurück (Trend, Unterstützung/Widerstand, Risiko-Einschätzung, Fazit) statt als Fließtext.
- Bei Portfolio-Fragen, Glossar-Begriffen, allgemeinen Marktfragen oder Fragen ohne Bezug zu Finanzdaten (z. B. dem heutigen Datum) antworte normal in Fließtext — present_market_analysis ist nur für instrumentenbezogene technische Einschätzungen gedacht.`;
}

function buildAnthropicClient(): Anthropic | null {
  const apiKey = process.env.CLAUDE_CHATBOT_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function toAnthropicHistory(history: ChatMessage[]): Anthropic.MessageParam[] {
  return history.map((m) => ({ role: m.role, content: m.content }));
}

export async function generateFinaraReply(
  message: string,
  appUser: AppUser,
  positions: PortfolioPosition[],
  history: ChatMessage[],
  chartAttachment?: ChartAttachment | null,
): Promise<string> {
  const client = buildAnthropicClient();
  if (!client) {
    return generateChatReply(message, appUser, positions);
  }

  try {
    const model = process.env.CLAUDE_CHATBOT_MODEL ?? "claude-sonnet-5";

    const userContent: string | Anthropic.ContentBlockParam[] = chartAttachment
      ? [
          {
            type: "image",
            source: { type: "base64", media_type: chartAttachment.mediaType, data: chartAttachment.base64 },
          },
          {
            type: "text",
            text: `[Chart-Bild von ${chartAttachment.symbol} beigefügt]\n\n${message}`,
          },
        ]
      : message;

    const messages: Anthropic.MessageParam[] = [
      ...toAnthropicHistory(history),
      { role: "user", content: userContent },
    ];

    for (let iteration = 0; iteration < 5; iteration++) {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system: buildSystemPrompt(),
        tools: [...financeTools, marketAnalysisTool],
        messages,
      });

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      const analysisBlock = toolUseBlocks.find((block) => block.name === "present_market_analysis");
      if (analysisBlock) {
        return JSON.stringify({ type: "market_analysis", ...(analysisBlock.input as object) });
      }

      if (toolUseBlocks.length === 0 || response.stop_reason !== "tool_use") {
        const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
        return textBlock?.text ?? "Dazu liegen mir aktuell keine verlässlichen Daten vor.";
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: await runFinanceTool(block.name, block.input as Record<string, unknown>, appUser, positions),
        })),
      );

      messages.push({ role: "user", content: toolResults });
    }

    return "Dazu liegen mir aktuell keine verlässlichen Daten vor.";
  } catch (err) {
    console.error("[FinaraAI] Anthropic call failed, falling back to rule-based engine:", err);
    return generateChatReply(message, appUser, positions);
  }
}
