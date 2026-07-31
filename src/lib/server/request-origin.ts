/**
 * Same-origin guard for mutating local API routes.
 *
 * NEXO's backend runs on localhost with the user's own filesystem privileges,
 * so any page open in the researcher's browser can issue a cross-site POST to
 * it. Several routes start jobs, write protocol folders or record state that
 * later widens what the app is allowed to read — a cross-site caller must not
 * reach them.
 *
 * The check uses the Fetch Metadata headers browsers send automatically and
 * falls back to comparing `Origin` against `Host`. A request with no `Origin`
 * and no `Sec-Fetch-Site` is allowed: that is a non-browser client (curl, the
 * user's own scripts, tests), which is not the threat model here — the threat
 * is a *browser* silently acting on behalf of another site.
 */

export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) {
    // Browsers that send Fetch Metadata: only same-origin/same-site and
    // direct navigations are acceptable for a mutating call.
    return site === "same-origin" || site === "same-site" || site === "none";
  }

  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser caller

  try {
    const originHost = new URL(origin).host;
    const host = request.headers.get("host");
    return Boolean(host) && originHost === host;
  } catch {
    return false;
  }
}

/** Throws when the request looks cross-site. Call at the top of mutating routes. */
export function assertSameOrigin(request: Request): void {
  if (!isSameOriginRequest(request)) {
    throw new Error(
      "Solicitud rechazada: proviene de otro sitio. Usa la interfaz de NEXO en tu navegador."
    );
  }
}
