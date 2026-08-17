import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ChartLineIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 17.5 9 11l4 3 8-9" />
      <path d="M15 5h6v6" />
    </svg>
  );
}

export function GaugeScoreIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <path d="M12 15V9" />
      <path d="M12 15l3.5-3.5" />
      <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.4 7 8.5 4.1-1.1 7-4.3 7-8.5V6l-7-2.5Z" />
      <path d="m9 12 2 2 4-4.5" />
    </svg>
  );
}

export function ChatBubbleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h16v10.5H9l-4 3.5V16H4V5.5Z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M21 18h-1" />
      <circle cx="15" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="7" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RocketIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3c2.8 1.3 4.5 4 4.5 8 0 2.7-1 4.7-2.2 6.2l-2.3 2.3-2.3-2.3C8.5 15.7 7.5 13.7 7.5 11c0-4 1.7-6.7 4.5-8Z" />
      <circle cx="12" cy="10.5" r="1.6" />
      <path d="M8.5 15.5 6 17.5v-3M15.5 15.5 18 17.5v-3" />
    </svg>
  );
}

export function CoinsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="9" cy="7" rx="5" ry="2.5" />
      <path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7" />
      <path d="M4 11v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4" />
      <ellipse cx="16" cy="13" rx="4" ry="2" />
      <path d="M12 13v3.5c0 1.1 1.8 2 4 2s4-.9 4-2V13" />
    </svg>
  );
}
