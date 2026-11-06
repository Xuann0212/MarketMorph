const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const paths: Record<string, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    swap: (
      <>
        <path d="M4 8h15M15 4l4 4-4 4" />
        <path d="M20 16H5M9 12l-4 4 4 4" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3-1.2 3.2L8 7.5l2.8 1.3L12 12l1.2-3.2L16 7.5l-2.8-1.3L12 3Z" />
        <path d="m5 13-.8 2.2L2 16l2.2.8L5 19l.8-2.2L8 16l-2.2-.8L5 13ZM19 13l-.6 1.4L17 15l1.4.6L19 17l.6-1.4L21 15l-1.4-.6L19 13Z" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </>
    ),
    layout: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 10v10" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    palette: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="8.5" cy="9" r=".8" fill="currentColor" />
        <circle cx="12" cy="7" r=".8" fill="currentColor" />
        <circle cx="15.5" cy="9" r=".8" fill="currentColor" />
        <path d="M16 15c0 1.2-1 2-2.1 2H12a2 2 0 0 1 0-4h2" />
      </>
    ),
    edit: (
      <>
        <path d="m4 16-.8 4 4-.8L18.5 8.9 15.1 5.5 4 16Z" />
        <path d="m13.8 6.8 3.4 3.4" />
      </>
    ),
    chevron: <path d="m8 10 4 4 4-4" />,
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M4 15v4h16v-4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    wand: (
      <>
        <path d="m15 4 5 5L8 21l-5-5L15 4Z" />
        <path d="m12 7 5 5M5 3v4M3 5h4M19 16v5M16.5 18.5h5" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    reset: (
      <>
        <path d="M4 10a8 8 0 1 1 2 8" />
        <path d="M4 4v6h6" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export default Icon;
