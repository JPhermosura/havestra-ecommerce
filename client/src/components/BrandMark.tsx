interface BrandMarkProps {
  className?: string;
}

export default function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      <path
        d="M16 27V14m0 4C9.5 18 6 14.5 6 8c6.5 0 10 3.5 10 10Zm0-5c6.5 0 10-3.5 10-10-6.5 0-10 3.5-10 10Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M10 27h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
