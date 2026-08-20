import { describe, expect, it } from "vitest";
import { resolveStrategyForUser } from "./index";

describe("resolveStrategyForUser", () => {
  it("maps a low risk profile to the Balanced strategy", () => {
    expect(resolveStrategyForUser({ riskProfile: "low" }).id).toBe("balanced");
  });

  it("maps a medium risk profile to the Balanced strategy", () => {
    expect(resolveStrategyForUser({ riskProfile: "medium" }).id).toBe("balanced");
  });

  it("maps a high risk profile to the Momentum strategy", () => {
    expect(resolveStrategyForUser({ riskProfile: "high" }).id).toBe("momentum");
  });

  it("falls back to Balanced when the user has no risk profile yet", () => {
    expect(resolveStrategyForUser({ riskProfile: null }).id).toBe("balanced");
  });
});
