"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/dictionaries";

const LOCALE_COOKIE = "locale";

/**
 * Header toggle that switches the UI between Spanish and English.
 *
 * Writes the choice to a `locale` cookie (1-year expiry, root path) and asks
 * Next.js to re-render the current route so server components pick up the new
 * cookie value through `cookies()`.
 *
 * Receives `currentLocale` from the parent server component to avoid any
 * client-side flicker during hydration.
 */
export function LocaleToggle({
  currentLocale,
  ariaLabel
}: {
  currentLocale: Locale;
  ariaLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setLocale(next: Locale) {
    if (next === currentLocale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className="locale-toggle"
      role="group"
      aria-label={ariaLabel}
      data-pending={isPending ? "true" : "false"}
    >
      <Languages size={15} aria-hidden="true" />
      {SUPPORTED_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          className={`locale-toggle-option${locale === currentLocale ? " active" : ""}`}
          onClick={() => setLocale(locale)}
          aria-pressed={locale === currentLocale}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
