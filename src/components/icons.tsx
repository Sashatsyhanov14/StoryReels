import React from "react";

export const Icons = {
  Sparkles: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      {/* Two-tone custom organic sparkles */}
      <path d="M12 3c.3 3.3 2.7 5.7 6 6-3.3.3-5.7 2.7-6 6-.3-3.3-2.7-5.7-6-6 3.3-.3 5.7-2.7 6-6Z" />
      <path d="M19 14c.2 1.5 1.2 2.5 2.7 2.7-1.5.2-2.5 1.2-2.7 2.7-.2-1.5-1.2-2.5-2.7-2.7 1.5-.2 2.5-1.2 2.7-2.7Z" opacity="0.4" />
    </svg>
  ),
  Coin: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      {/* Double ring neon token icon */}
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" opacity="0.4" />
      <path d="M12 9v6" />
      <path d="M10 12h4" />
    </svg>
  ),
  Tv: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      {/* Premium curved borderless display */}
      <rect width="20" height="13" x="2" y="4" rx="3" />
      <path d="M12 17v4" />
      <path d="M8 21h8" opacity="0.5" />
    </svg>
  ),
  Clapperboard: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      {/* Modern film clapperboard */}
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
      <path d="m3 9 3-4h15l-3 4H3Z" opacity="0.5" />
      <path d="M6.5 5v4" opacity="0.5" />
      <path d="M11.5 5v4" opacity="0.5" />
      <path d="M16.5 5v4" opacity="0.5" />
    </svg>
  ),
  Wand: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      {/* Creative magic wand */}
      <path d="M19 5L5 19" />
      <path d="M19 5l-2-2" />
      <circle cx="9" cy="6" r="1" opacity="0.4" fill="currentColor" />
      <circle cx="16" cy="13" r="1" opacity="0.4" fill="currentColor" />
      <circle cx="6" cy="11" r="1.5" opacity="0.6" fill="currentColor" />
      <circle cx="18" cy="8" r="1.5" opacity="0.6" fill="currentColor" />
    </svg>
  ),
  XCircle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <circle cx="12" cy="12" r="9" opacity="0.3" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  ),
  Play: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      {/* Rounded play button */}
      <path d="M7.5 5.5v13a1.5 1.5 0 0 0 2.25 1.3l10-6.5a1.5 1.5 0 0 0 0-2.6l-10-6.5A1.5 1.5 0 0 0 7.5 5.5Z" />
    </svg>
  ),
  List: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <circle cx="3.5" cy="6" r="1.5" opacity="0.5" fill="currentColor" />
      <circle cx="3.5" cy="12" r="1.5" opacity="0.5" fill="currentColor" />
      <circle cx="3.5" cy="18" r="1.5" opacity="0.5" fill="currentColor" />
    </svg>
  ),
  Loader: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      {/* Motion-simulating spinner segments */}
      <path d="M12 3v3" />
      <path d="m16.25 7.75 2.15-2.15" opacity="0.9" />
      <path d="M18 12h3" opacity="0.8" />
      <path d="m16.25 16.25 2.15 2.15" opacity="0.7" />
      <path d="M12 18v3" opacity="0.6" />
      <path d="m7.75 16.25-2.15 2.15" opacity="0.5" />
      <path d="M3 12h3" opacity="0.4" />
      <path d="m7.75 7.75-2.15-2.15" opacity="0.3" />
    </svg>
  ),
  Pen: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M13.5 4.5l6 6M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L4 16v4Z" />
    </svg>
  ),
  Palette: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10c0 1.5-.5 3-1.5 4s-2.5 1-3.5 1H16a2 2 0 0 0-2 2c0 .5-.2 1-.5 1.5-.5.5-1 1.5-1.5 1.5Z" />
      <circle cx="7.5" cy="10.5" r="1.5" opacity="0.5" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1.5" opacity="0.5" fill="currentColor" />
      <circle cx="16.5" cy="10.5" r="1.5" opacity="0.5" fill="currentColor" />
    </svg>
  ),
  Mic: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <rect width="6" height="12" x="9" y="3" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" opacity="0.7" />
      <path d="M12 18v3" />
      <path d="M8 21h8" opacity="0.5" />
    </svg>
  ),
  Package: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M12 2L4 6.5v11L12 22l8-4.5v-11L12 2Z" />
      <path d="M12 12V22" opacity="0.6" />
      <path d="M12 12L4 6.5" opacity="0.6" />
      <path d="M12 12l8-5.5" opacity="0.6" />
    </svg>
  ),
  Search: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" opacity="0.6" />
    </svg>
  ),
  ArrowLeft: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M19 12H5" />
      <path d="m10 17-5-5 5-5" />
    </svg>
  ),
  ArrowRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  ),
  Vibrate: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M6 8a4 4 0 0 1 8 0v8a4 4 0 0 1-8 0V8Z" />
      <path d="M2 10h2M2 14h2" opacity="0.4" />
      <path d="M20 10h2M20 14h2" opacity="0.4" />
    </svg>
  ),
  Whirlpool: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <circle cx="12" cy="12" r="9" opacity="0.3" />
      <path d="M12 8a4 4 0 1 1-4 4" />
      <path d="M12 6a6 6 0 1 0 6 6" opacity="0.6" />
    </svg>
  ),
  Hourglass: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M6 2h12M6 22h12" />
      <path d="M6 2v4a4 4 0 0 0 2 3.46L12 12l4-2.54A4 4 0 0 0 18 6V2" />
      <path d="M6 22v-4a4 4 0 0 1 2-3.46L12 12l4 2.54a4 4 0 0 1 2 3.46v4" opacity="0.5" />
    </svg>
  ),
  Plus: (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={props.strokeWidth || "1.75"} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
};
