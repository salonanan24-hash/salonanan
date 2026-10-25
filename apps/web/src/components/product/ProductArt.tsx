import type { ReactNode } from 'react';

type ProductArtProps = {
  categorySlug: string;
};

export function ProductArt({ categorySlug }: ProductArtProps) {
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true" className="mx-auto h-36 w-full">
      <rect width="200" height="150" fill="#ffffff" />
      {shapeFor(categorySlug)}
    </svg>
  );
}

function shapeFor(categorySlug: string): ReactNode {
  switch (categorySlug) {
    case 'refrigerators':
      return (
        <>
          <rect
            x="58"
            y="18"
            width="84"
            height="114"
            rx="6"
            fill="#fff"
            stroke="#0c5695"
            strokeWidth="3"
          />
          <path d="M100 22v106" stroke="#0c5695" strokeWidth="2" />
          <rect x="88" y="46" width="6" height="24" rx="2" fill="#e52629" />
          <rect x="106" y="68" width="6" height="24" rx="2" fill="#0c5695" />
        </>
      );
    case 'washing-machines':
      return (
        <>
          <rect
            x="48"
            y="20"
            width="104"
            height="110"
            rx="8"
            fill="#fff"
            stroke="#0c5695"
            strokeWidth="3"
          />
          <circle cx="100" cy="84" r="30" fill="#f4f7fb" stroke="#0c5695" strokeWidth="3" />
          <circle cx="100" cy="84" r="12" fill="#e52629" />
          <circle cx="68" cy="38" r="4" fill="#0c5695" />
        </>
      );
    case 'dryers':
      return (
        <>
          <rect
            x="48"
            y="20"
            width="104"
            height="110"
            rx="8"
            fill="#fff"
            stroke="#0c5695"
            strokeWidth="3"
          />
          <circle cx="100" cy="82" r="28" fill="#fff" stroke="#0c5695" strokeWidth="3" />
          <path d="M86 82h28M100 68v28" stroke="#e52629" strokeWidth="2" />
        </>
      );
    case 'televisions':
      return (
        <>
          <rect x="32" y="28" width="136" height="82" rx="6" fill="#12324f" />
          <rect x="40" y="36" width="120" height="66" fill="#0c5695" />
          <rect x="86" y="112" width="28" height="8" fill="#1a2332" />
          <rect x="70" y="120" width="60" height="6" rx="2" fill="#1a2332" />
          <rect x="52" y="48" width="28" height="4" fill="#e52629" />
        </>
      );
    case 'ovens':
      return (
        <>
          <rect
            x="50"
            y="22"
            width="100"
            height="108"
            rx="6"
            fill="#fff"
            stroke="#0c5695"
            strokeWidth="3"
          />
          <rect
            x="64"
            y="40"
            width="72"
            height="48"
            rx="3"
            fill="#f4f7fb"
            stroke="#0c5695"
            strokeWidth="2"
          />
          <circle cx="78" cy="108" r="5" fill="#e52629" />
          <circle cx="100" cy="108" r="5" fill="#0c5695" />
          <circle cx="122" cy="108" r="5" fill="#0c5695" />
        </>
      );
    case 'dishwashers':
      return (
        <>
          <rect
            x="54"
            y="18"
            width="92"
            height="114"
            rx="6"
            fill="#fff"
            stroke="#0c5695"
            strokeWidth="3"
          />
          <path d="M66 48h68" stroke="#0c5695" strokeWidth="3" />
          <rect x="88" y="40" width="24" height="5" rx="2" fill="#e52629" />
          <path d="M70 78h60M70 92h60" stroke="#9aafc4" strokeWidth="2" />
        </>
      );
    case 'air-conditioners':
      return (
        <>
          <rect
            x="36"
            y="40"
            width="128"
            height="42"
            rx="6"
            fill="#fff"
            stroke="#0c5695"
            strokeWidth="3"
          />
          <path d="M48 62h104" stroke="#e52629" strokeWidth="3" />
          <path
            d="M70 96c8 10 16 10 24 0M106 96c8 10 16 10 24 0"
            stroke="#0c5695"
            strokeWidth="2"
            fill="none"
          />
        </>
      );
    case 'small-appliances':
      return (
        <>
          <rect x="70" y="28" width="28" height="46" rx="6" fill="#e52629" />
          <rect x="78" y="18" width="12" height="16" rx="3" fill="#0c5695" />
          <path d="M62 74h76v28a28 28 0 0 1-76 0z" fill="#fff" stroke="#0c5695" strokeWidth="3" />
        </>
      );
    case 'computers':
      return (
        <>
          <rect
            x="48"
            y="28"
            width="104"
            height="68"
            rx="4"
            fill="#fff"
            stroke="#0c5695"
            strokeWidth="3"
          />
          <rect x="56" y="36" width="88" height="52" fill="#0c5695" />
          <path d="M40 108h120l-12 12H52z" fill="#1a2332" />
        </>
      );
    case 'smartphones':
      return (
        <>
          <rect
            x="72"
            y="18"
            width="56"
            height="114"
            rx="8"
            fill="#fff"
            stroke="#0c5695"
            strokeWidth="3"
          />
          <rect x="80" y="32" width="40" height="78" fill="#f4f7fb" />
          <circle cx="100" cy="120" r="4" fill="#e52629" />
        </>
      );
    default:
      return (
        <rect
          x="50"
          y="30"
          width="100"
          height="90"
          rx="6"
          fill="#fff"
          stroke="#0c5695"
          strokeWidth="3"
        />
      );
  }
}
