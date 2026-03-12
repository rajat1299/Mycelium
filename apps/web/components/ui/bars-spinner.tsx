"use client";

type BarsSpinnerProps = {
  size?: number;
  color?: string;
  className?: string;
};

export function BarsSpinner({
  size = 16,
  color = "currentColor",
  className
}: BarsSpinnerProps) {
  const width = Math.max(2, Math.round(size / 6));
  const gap = Math.max(2, Math.round(size / 8));

  return (
    <span
      aria-hidden="true"
      className={["inline-flex items-end", className].filter(Boolean).join(" ")}
      style={{ gap }}
    >
      {Array.from({ length: 4 }, (_, index) => (
        <span
          key={index}
          className="animate-[spell-bars_0.9s_ease-in-out_infinite]"
          style={{
            width,
            height: size,
            animationDelay: `${index * 0.12}s`,
            backgroundColor: color,
            borderRadius: 999
          }}
        />
      ))}
    </span>
  );
}
