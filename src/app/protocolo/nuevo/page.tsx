import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { WizardShell } from "@/components/wizard/WizardShell";
import { getDictionary } from "@/lib/i18n/server";

export default async function NewProtocolPage() {
  const t = await getDictionary();
  return (
    <AppShell showFooterCta={false}>
      <main>
        <div className="page-header-compact">
          <div>
            <p className="eyebrow" style={{ color: "var(--teal-dark)", margin: 0 }}>
              {t.newProtocol.eyebrow}
            </p>
            <h1 className="page-header-compact-title">{t.newProtocol.title}</h1>
          </div>
          <Link href="/comenzar" className="button-ghost">
            <ArrowLeft size={15} />
            {t.newProtocol.backToStart}
          </Link>
        </div>
        <section className="section section-tight">
          <WizardShell t={t} />
        </section>
      </main>
    </AppShell>
  );
}
