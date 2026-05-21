/**
 * Server-side helpers to read the active locale from the request cookie.
 *
 * Pattern:
 *   - The locale lives in a `locale` cookie (values: "es" | "en").
 *   - Server components call `getLocale()` and `getDictionary()` synchronously.
 *   - The client-side LocaleToggle sets the cookie and refreshes the route.
 *
 * If the cookie is missing or holds an unsupported value, we fall back to the
 * `Accept-Language` header (light parse) and finally to DEFAULT_LOCALE.
 */

import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  dictionaries,
  type Dictionary,
  type Locale
} from "./dictionaries";

export const LOCALE_COOKIE = "locale";

function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (SUPPORTED_LOCALES as string[]).includes(value);
}

function parseAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  // Take the first preferred two-letter code we recognise.
  for (const fragment of header.split(",")) {
    const code = fragment.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return null;
}

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const headerStore = await headers();
  const fallback = parseAcceptLanguage(headerStore.get("accept-language"));
  return fallback ?? DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<Dictionary> {
  const locale = await getLocale();
  return dictionaries[locale];
}
