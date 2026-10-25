import Link from "next/link";

type ProgressNavProps = {
  tripId: string;
  currentStep: number;
  optionsReady: boolean;
  itineraryReady: boolean;
};

// The five planning stages. Stages that can be opened are links.
export function ProgressNav({ tripId, currentStep, optionsReady, itineraryReady }: ProgressNavProps) {
  const steps = [
    { label: "Get Ready", href: `/trip/${tripId}`, available: true },
    { label: "Compare Options", href: `/trip/${tripId}/options`, available: optionsReady },
    { label: "Decide Together", href: `/trip/${tripId}/options#decide-together`, available: optionsReady },
    { label: "Shared Itinerary", href: `/trip/${tripId}/itinerary`, available: itineraryReady },
    { label: "Book Travel", href: `/trip/${tripId}/travel`, available: itineraryReady },
  ];

  return (
    <nav aria-label="Planning progress">
      <ol className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => {
          const reached = index <= currentStep;
          const bar = <div className={`h-1.5 rounded-full transition ${reached ? "bg-[#e4664f]" : "bg-[#dfe3e1]"} ${step.available ? "group-hover:h-2" : ""}`} />;
          const label = (
            <p className={`mt-2 text-xs font-bold sm:text-sm ${index === currentStep ? "text-[#e4664f]" : reached ? "text-[#c9533f]" : "text-[#8a9599]"}`}>
              {step.label}
            </p>
          );

          return (
            <li key={step.label}>
              {step.available ? (
                <Link aria-current={index === currentStep ? "step" : undefined} className="group block rounded-lg py-1 hover:opacity-90" href={step.href}>
                  {bar}
                  {label}
                </Link>
              ) : (
                <div aria-disabled="true" className="py-1" title="Not available yet">
                  {bar}
                  {label}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
