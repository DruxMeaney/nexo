"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  FolderOpen,
  Loader2,
  Pencil,
  Play,
  Sparkles
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { ProtocolDraft } from "@/lib/protocol/types";

interface ProtocolListItem {
  slug: string;
  name: string;
  description: string;
  author: string;
  savedAt: string;
}

interface LoadResponse {
  slug?: string;
  draft?: ProtocolDraft;
  warnings?: string[];
  error?: string;
}

const STORAGE_KEY = "nexo.protocol-draft.v1";

/**
 * Format a saved timestamp using the navigator's locale, with a long-form
 * style that avoids ambiguous "11/6/2026". E.g. "6 nov 2026, 11:08".
 */
function formatSavedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface Props {
  t: Dictionary;
}

/**
 * Lists saved protocols (GET /api/protocol/list), and on click loads a
 * protocol (POST /api/protocol/load-folder), pushes its draft into the
 * wizard's localStorage key, then redirects to /protocolo/nuevo where the
 * designer rehydrates it automatically.
 *
 * Errors and warnings are surfaced inline rather than via alerts — the user
 * stays on the list and can pick another protocol.
 */
export function LoadProtocolList({ t }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ProtocolListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/protocol/list", { cache: "no-store" });
        if (!response.ok) throw new Error(`status_${response.status}`);
        const payload = (await response.json()) as { protocols: ProtocolListItem[] };
        if (!cancelled) setItems(payload.protocols);
      } catch (cause) {
        if (!cancelled) {
          setListError(cause instanceof Error ? cause.message : "list_failed");
          setItems([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLoad(slug: string) {
    setLoadingSlug(slug);
    setRowError(null);
    setWarnings(null);
    try {
      const response = await fetch("/api/protocol/load-folder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug })
      });
      const payload = (await response.json()) as LoadResponse;
      if (!response.ok || !payload.draft) {
        setRowError(payload.error || "load_failed");
        return;
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.draft));
      } catch {
        /* Browser without localStorage — the redirect will still work but the
           draft will not survive a reload. Acceptable degraded behaviour. */
      }
      if (payload.warnings && payload.warnings.length > 0) {
        setWarnings(payload.warnings);
        // Give the user a moment to see warnings before navigating.
        setTimeout(() => router.push("/protocolo/nuevo"), 1200);
      } else {
        router.push("/protocolo/nuevo");
      }
    } catch (cause) {
      setRowError(cause instanceof Error ? cause.message : "load_failed");
    } finally {
      setLoadingSlug(null);
    }
  }

  if (items === null) {
    return (
      <div className="protocols-empty">
        <Loader2 size={20} className="spin" aria-hidden="true" />
        <p>{t.loadProtocol.loading}</p>
      </div>
    );
  }

  if (listError) {
    return (
      <div className="notice notice-danger" role="alert">
        <strong>{t.loadProtocol.loadError}</strong>
        <p className="mono" style={{ margin: 0 }}>
          {listError}
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="protocols-empty-state">
        <FolderOpen size={36} color="var(--muted)" aria-hidden="true" />
        <div>
          <h2 style={{ marginTop: 0 }}>{t.loadProtocol.emptyTitle}</h2>
          <p>{t.loadProtocol.emptyCopy}</p>
          <Link className="button" href="/protocolo/nuevo">
            <Sparkles size={16} />
            {t.loadProtocol.designNewCta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="protocols-list">
      {warnings ? (
        <div className="notice" role="status">
          <strong>{t.loadProtocol.warningsTitle}</strong>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            {warnings.map((file) => (
              <li key={file} className="mono">
                {file}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {rowError ? (
        <div className="notice notice-danger" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <p style={{ margin: 0 }}>
            {t.loadProtocol.loadOneError} ({rowError})
          </p>
        </div>
      ) : null}
      {items.map((item) => (
        <article key={item.slug} className="protocol-row">
          <div className="protocol-row-meta">
            <h3>{item.name}</h3>
            {item.description ? <p>{item.description}</p> : null}
            <p className="muted">
              {item.author ? (
                <>
                  {t.loadProtocol.authorPrefix} {item.author}
                </>
              ) : null}
              {item.author && item.savedAt ? " · " : null}
              {item.savedAt ? (
                <>
                  {t.loadProtocol.savedAtPrefix}{" "}
                  <time dateTime={item.savedAt}>
                    {formatSavedAt(item.savedAt)}
                  </time>
                </>
              ) : null}
            </p>
            <p className="mono muted" style={{ marginTop: 4 }}>
              {t.loadProtocol.slugPrefix} config/protocols/{item.slug}/
            </p>
          </div>
          <div className="protocol-row-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={() => onLoad(item.slug)}
              disabled={loadingSlug !== null}
            >
              {loadingSlug === item.slug ? (
                <>
                  <Loader2 size={16} className="spin" />
                  {t.loadProtocol.loading_one}
                </>
              ) : (
                <>
                  <Pencil size={15} />
                  {t.loadProtocol.editAction}
                </>
              )}
            </button>
            <Link
              className="button"
              href={`/ejecutar?protocol=${encodeURIComponent(item.slug)}`}
            >
              <Play size={15} />
              {t.loadProtocol.runAction}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
