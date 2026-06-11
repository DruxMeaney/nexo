"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, PlayCircle, X } from "lucide-react";

interface Props {
  t: {
    method: string;
    results: string;
    start: string;
    ariaLabel: string;
  };
}

/**
 * Hamburger menu for narrow viewports.
 *
 * Visible only when CSS opens it (controlled by .nav-mobile in globals.css).
 * Expands to a dropdown sheet anchored to the header, with the same three
 * nav targets as the desktop nav. The ES/EN toggle stays outside this
 * component because it must always be visible.
 *
 * Closes on:
 *   - link click
 *   - Escape key
 *   - clicking the backdrop
 *   - viewport resize above the mobile breakpoint
 */
export function MobileNav({ t }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 900) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="mobile-nav-trigger"
        aria-label={t.ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open ? (
        <>
          <div className="mobile-nav-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <nav className="mobile-nav-panel" aria-label={t.ariaLabel}>
            <Link href="/metodo" onClick={() => setOpen(false)}>
              {t.method}
            </Link>
            <Link href="/resultados" onClick={() => setOpen(false)}>
              {t.results}
            </Link>
            <Link href="/comenzar" onClick={() => setOpen(false)}>
              <PlayCircle size={17} />
              {t.start}
            </Link>
          </nav>
        </>
      ) : null}
    </>
  );
}
