import { AppUser, RiskProfile } from "@/lib/types";
import { getStrategy, STRATEGIES, StrategyDefinition } from "@/lib/strategy";

/**
 * Deliberately thin. The target architecture describes an Orchestrator that decides "which
 * asset(s), single analysis vs. comparison, which strategy, which data" before the LLM is
 * involved — but the "which asset(s)/comparison" part is exactly what Claude's own tool-calling
 * already does well (it reads the user's question, decides which symbol(s) to call get_analysis
 * for, and can call it more than once for a comparison — see lib/finara-ai/client.ts's tool
 * loop). Rebuilding that with regex/keyword matching here would only be a worse, second copy of
 * the same NLU, not a genuine separate layer.
 *
 * What genuinely belongs in a deterministic pre-LLM step is picking the default STRATEGY from
 * structured user data (risk profile) — that's a business rule, not something the model should
 * be left to invent per-request. That's what this module actually does.
 */
const RISK_PROFILE_STRATEGY: Record<RiskProfile, string> = {
  low: "balanced",
  medium: "balanced",
  high: "momentum",
};

export function resolveStrategyForUser(appUser: Pick<AppUser, "riskProfile">): StrategyDefinition {
  const id = appUser.riskProfile ? RISK_PROFILE_STRATEGY[appUser.riskProfile] : "balanced";
  return getStrategy(id) ?? STRATEGIES[0];
}
