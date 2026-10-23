interface DemoBadgeProps {
  className?: string;
  subtext?: string;
}

export function DemoBadge({ className = '', subtext }: DemoBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-[#CFDBE5] bg-[#E8EEF3] text-[#0F2837] ${className}`}
      title="This view uses local curriculum sample data"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#1B8E8E]" aria-hidden="true" />
      <span className="font-semibold tracking-wide uppercase text-[10px]">Demo data</span>
      {subtext && (
        <>
          <span className="text-[#0F2837]/40" aria-hidden="true">·</span>
          <span className="text-[#0F2837]/70 font-normal">{subtext}</span>
        </>
      )}
    </div>
  );
}
