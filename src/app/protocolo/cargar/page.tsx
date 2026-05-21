import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LoadProtocolList } from "@/components/protocol/LoadProtocolList";
import { getDictionary } from "@/lib/i18n/server";

export default async function LoadProtocolPage() {
  const t = await getDictionary();
  return (
    <AppShell>
      <main>
        <section className="page-title">
          <p className="eyebrow" style={{ color: "var(--rust)" }}>
            {t.loadProtocol.eyebrow}
          </p>
          <h1>{t.loadProtocol.title}</h1>
          <p>{t.loadProtocol.copy}</p>
          <Link
            href="/comenzar"
            className="button-ghost"
            style={{ marginTop: 8, paddingLeft: 0 }}
          >
            <ArrowLeft size={15} />
            {t.loadProtocol.backToStart}
          </Link>
        </section>

        <section className="section">
          <LoadProtocolList t={t} />
        </section>
      </main>
    </AppShell>
  );
}
