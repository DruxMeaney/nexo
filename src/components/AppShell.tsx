import Link from "next/link";
import { ArrowRight, FlaskConical, Network, PlayCircle } from "lucide-react";
import { LocaleToggle } from "@/components/LocaleToggle";
import { MobileNav } from "@/components/MobileNav";
import { getDictionary, getLocale } from "@/lib/i18n/server";

interface AppShellProps {
  children: React.ReactNode;
  /**
   * When false, hides the marketing "Comenzar revisión" footer panel. The
   * landing keeps it; internal pages (wizard, runner, results) set this to
   * false so the CTA does not duplicate or contradict their own context.
   */
  showFooterCta?: boolean;
}

export async function AppShell({ children, showFooterCta = true }: AppShellProps) {
  const [locale, t] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              <Network size={19} strokeWidth={2.1} />
            </span>
            <span>{t.common.brand}</span>
          </Link>
          <nav className="nav nav-desktop" aria-label={t.nav.primaryAriaLabel}>
            <Link href="/metodo">{t.nav.method}</Link>
            <Link href="/resultados">{t.nav.results}</Link>
            <Link href="/comenzar">
              <PlayCircle size={17} />
              {t.nav.start}
            </Link>
            <LocaleToggle currentLocale={locale} ariaLabel={t.common.languageToggleAria} />
          </nav>
          <div className="nav-mobile">
            <LocaleToggle currentLocale={locale} ariaLabel={t.common.languageToggleAria} />
            <MobileNav
              t={{
                method: t.nav.method,
                results: t.nav.results,
                start: t.nav.start,
                ariaLabel: t.nav.primaryAriaLabel
              }}
            />
          </div>
        </div>
      </header>
      {children}
      {showFooterCta ? (
        <footer className="site-footer">
          <div className="section">
            <div className="footer-grid">
              <div>
                <p className="eyebrow dark">{t.footer.eyebrow}</p>
                <h2>{t.footer.title}</h2>
                <p>{t.footer.copy}</p>
              </div>
              <Link className="button-secondary" href="/comenzar">
                <FlaskConical size={17} />
                {t.footer.cta}
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
