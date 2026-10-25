import Link from "next/link";

type ProgressNavProps = {
  tripId: string;
  currentStep: number;
  optionsReady: boolean;
  itineraryReady: boolean;
};

// The four planning stages. Stages that can be opened are links.
export function ProgressNav({ tripId, currentStep, optionsReady, itineraryReady }: ProgressNavProps) {
  const steps = [
    { label: "Get Ready", href: `/trip/${tripId}`, available: true },
    { label: "Itinerary Options & Vote", href: `/trip/${tripId}/options`, available: optionsReady },
    { label: "Shared Itinerary", href: `/trip/${tripId}/itinerary`, available: itineraryReady },
    { label: "Book Travel", href: `/trip/${tripId}/travel`, available: itineraryReady },
  ];

  return (
    <nav aria-label="Planning progress">
      <ol className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const reached = index <= currentStep;
          const bar = <div className={`relative h-1.5 rounded-full transition ${reached ? "bg-[#397bb3]" : "bg-[#dfe3e1]"} ${step.available ? "group-hover:h-2" : ""}`} >{index === currentStep ? <span aria-hidden="true" className="absolute -top-3 right-1 text-xl">✈️</span> : null}</div>;
          const label = (
            <p className={`mt-2 text-xs font-bold sm:text-sm ${index === currentStep ? "text-[#397bb3]" : reached ? "text-[#2f6699]" : "text-[#8a9599]"}`}>
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
