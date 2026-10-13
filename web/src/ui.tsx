import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { getAddress, type Address } from "viem";
import type { Runtime } from "./config";
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    crystal: (
      <>
        <path d="m12 2 7 8-7 12-7-12zM12 2v20M5 10h14" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h15m-6-6 6 6-6 6" />
      </>
    ),
    play: <path d="m8 4 12 8-12 8z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    cult: (
      <>
        <path d="m12 2 9 17H3zM12 8v5m0 3v1" />
      </>
    ),
    wallet: (
      <>
        <path d="M20 7V4H4v16h16v-5m-6-8h7v8h-7z" />
        <path d="M17 11h1" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 8a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 3m0 3v1" />
      </>
    ),
    build: (
      <>
        <path d="M3 20h18M5 20V9h14v11M8 9V4h8v5m-4 5v6" />
      </>
    ),
    recruit: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M5 21v-4a7 7 0 0 1 14 0v4m-7-6v6m-3-3h6" />
      </>
    ),
    attack: (
      <>
        <path d="m4 4 14 14m-5-1 4-4m-2 4 5 5M20 3 6 17m0-4 4 4m-4-2-4 5" />
      </>
    ),
    flag: (
      <>
        <path d="M5 22V3m0 1c5-5 9 5 15 0v10c-6 5-10-5-15 0" />
      </>
    ),
    repair: (
      <>
        <path d="M14 4a5 5 0 0 0-6 6L2 17l5 5 7-7a5 5 0 0 0 6-6l-4 3-4-4z" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    volume: (
      <>
        <path d="M3 9h4l5-5v16l-5-5H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    muted: (
      <>
        <path d="M3 9h4l5-5v16l-5-5H3zm13 0 6 6m0-6-6 6" />
      </>
    ),
    expand: <path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" />,
    cross: (
      <>
        <circle cx="12" cy="12" r="6" />
        <path d="M12 1v6m0 10v6M1 12h6m10 0h6" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="1" />
        <path d="M15 8V3H3v13h5" />
      </>
    ),
    link: (
      <>
        <path d="M14 3h7v7m0-7L10 14M9 4H3v17h17v-6" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.crystal}
    </svg>
  );
}
export function PepePortrait({ cult = false }: { cult?: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 160 140" aria-hidden="true" className="pepe-portrait">
      <defs>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <pattern id={`${id}-scanlines`} width="160" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 0h160v1H0z" fill="#071214" />
        </pattern>
      </defs>
      <path fill={cult ? "#382332" : "#173e3e"} d="M0 0h160v140H0z" />
      <path
        fill={cult ? "#694952" : "#496257"}
        d="m20 140 8-38 25-14h54l25 14 8 38z"
      />
      <path fill="#5e903f" d="m41 45 16-17 48 3 19 22-5 42-22 16H62L40 91z" />
      <path fill="#91b859" d="m41 45 20-10 36 6 23 14-14 12-49-2z" />
      <path fill="#26362c" d="m25 45 12-25 43-9 39 12 14 27-11 8-31-13-45 9z" />
      <path fill="#e0e1ab" d="m48 51 23-2 5 19-23 2zm39-1 26 5-4 17-25-5z" />
      <path fill="#151e19" d="M62 53h9v13h-9zm27 2h9v12h-9z" />
      <path d="m50 84 51 5 15-8-14 18-46-4z" fill="#335b30" />
      <path d="m51 85 51 4 13-7" fill="none" stroke="#bdce79" strokeWidth="3" />
      <path
        d="m63 113 17 13 18-13M50 140l7-28m50 28-4-28"
        fill="none"
        stroke="#1d322b"
        strokeWidth="5"
      />
      <path fill={cult ? "#f08cab" : "#58e3d6"} d="m112 111 7 3-6 10-7-4z" />
      <g pointerEvents="none">
        <path d="M0 0h160v140H0z" filter={`url(#${id}-grain)`} opacity="0.18" style={{ mixBlendMode: "soft-light" }} />
        <path d="M0 0h160v140H0z" fill={`url(#${id}-scanlines)`} opacity="0.3" />
      </g>
    </svg>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      prev?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function AddressLink({
  address,
  runtime,
  label,
}: {
  address: Address;
  runtime: Runtime;
  label: string;
}) {
  return (
    <div className="address-row">
      <span>{label}</span>
      <a
        href={`${runtime.config.network.explorer}/address/${address}`}
        target="_blank"
        rel="noreferrer"
        title={getAddress(address)}
      >
        {getAddress(address)}
        <Icon name="link" size={14} />
      </a>
      <button
        className="icon-button"
        aria-label={`Copy ${label} address`}
        onClick={async (e) => {
          const button = e.currentTarget;
          try {
            await navigator.clipboard.writeText(getAddress(address));
            button.setAttribute("aria-label", `${label} address copied`);
          } catch {
            button.setAttribute(
              "aria-label",
              "Copy unavailable; select the address link",
            );
          }
        }}
      >
        <Icon name="copy" size={16} />
      </button>
    </div>
  );
}
