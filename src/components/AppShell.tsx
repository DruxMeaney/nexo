import Link from "next/link";
import { ArrowRight, FlaskConical, Network, PlayCircle } from "lucide-react";
import { LocaleToggle } from "@/components/LocaleToggle";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export async function AppShell({ children }: { children: React.ReactNode }) {
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
          <nav className="nav" aria-label={t.nav.primaryAriaLabel}>
            <Link href="/#metodo">{t.nav.method}</Link>
            <Link href="/resultados">{t.nav.results}</Link>
            <Link href="/comenzar">
              <PlayCircle size={17} />
              {t.nav.start}
            </Link>
            <LocaleToggle currentLocale={locale} ariaLabel={t.common.languageToggleAria} />
          </nav>
        </div>
      </header>
      {children}
      <footer className="section compact">
        <div className="panel">
          <div className="section-heading" style={{ marginBottom: 0 }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--teal-dark)", marginBottom: 8 }}>
                {t.footer.eyebrow}
              </p>
              <h2 style={{ fontSize: "1.35rem" }}>{t.footer.title}</h2>
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
    </div>
  );
}
