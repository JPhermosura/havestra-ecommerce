export default function BrandWatermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-0 top-32 z-0 select-none text-emerald-950/[0.045]"
    >
      <svg
        viewBox="0 0 360 360"
        className="h-44 w-44 sm:h-64 sm:w-64 lg:h-80 lg:w-80"
        fill="none"
        focusable="false"
      >
        <circle
          cx="180"
          cy="170"
          r="132"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M180 252V142m0 43c-37 0-58-21-58-54 32 0 58 20 58 54Zm0-29c37 0 58-21 58-54-32 0-58 20-58 54Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="8"
        />
        <path
          d="M126 252h108"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="8"
        />
        <text
          x="180"
          y="330"
          fill="currentColor"
          fontFamily="sans-serif"
          fontSize="22"
          fontWeight="700"
          letterSpacing="5"
          textAnchor="middle"
        >
          HAVESTRA
        </text>
      </svg>
    </div>
  );
}
