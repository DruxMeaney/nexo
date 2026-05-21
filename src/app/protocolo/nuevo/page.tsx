import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { WizardShell } from "@/components/wizard/WizardShell";
import { getDictionary } from "@/lib/i18n/server";

export default async function NewProtocolPage() {
  const t = await getDictionary();
  return (
    <AppShell>
      <main>
        <section className="page-title">
          <p className="eyebrow" style={{ color: "var(--teal-dark)" }}>
            {t.newProtocol.eyebrow}
          </p>
          <h1>{t.newProtocol.title}</h1>
          <p>{t.newProtocol.copy}</p>
          <Link
            href="/comenzar"
            className="button-ghost"
            style={{ marginTop: 8, paddingLeft: 0 }}
          >
            <ArrowLeft size={15} />
            {t.newProtocol.backToStart}
          </Link>
        </section>

        <section className="section">
          <WizardShell t={t} />
        </section>
      </main>
    </AppShell>
  );
}
