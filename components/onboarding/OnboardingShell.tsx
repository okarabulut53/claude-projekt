const steps = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "depot", label: "Depot" },
  { key: "risikoprofil", label: "Risikoprofil" },
];

export function OnboardingShell({
  activeStep,
  title,
  description,
  children,
}: {
  activeStep: "whatsapp" | "depot" | "risikoprofil";
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const activeIndex = steps.findIndex((s) => s.key === activeStep);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-surface px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center gap-2">
          {steps.map((step, index) => (
            <div key={step.key} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  index <= activeIndex
                    ? "bg-brand-teal text-white"
                    : "bg-surface text-foreground/40 border border-brand-border"
                }`}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 ${index < activeIndex ? "bg-brand-teal" : "bg-brand-border"}`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-brand-border bg-surface p-8 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
