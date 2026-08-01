"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FolderPlus, Plus, Upload } from "lucide-react";
import {
  countCategories,
  countTerms,
  createCategoryNode,
  createTermNode,
  insertNode
} from "@/lib/protocol/draft";
import { variableFromJson } from "@/lib/protocol/format";
import { pickLabel, type Dictionary } from "@/lib/i18n/dictionaries";
import { pluralize } from "@/lib/i18n/format";
import type { ProtocolVariable, TaxonomyNode } from "@/lib/protocol/types";
import { TaxonomyNodeRow } from "./TaxonomyNodeRow";

interface Props {
  variable: ProtocolVariable;
  /** Apply a tree-level update to this variable. */
  onChangeTree: (updater: (tree: TaxonomyNode[]) => TaxonomyNode[]) => void;
  /** Replace the variable entirely (used by JSON import). */
  onReplaceVariable: (next: ProtocolVariable) => void;
  /** Label shown in the import button so users know which variable is which. */
  importButtonLabel: string;
  /** Set of term-node ids the wizard should paint as invalid (missing label or patterns). */
  incompleteIds: Set<string>;
  /** True when the whole variable is invalid (e.g. has no terms at all). */
  containerInvalid: boolean;
  t: Dictionary;
}

/**
 * Tree editor for one variable. Owns the import-from-JSON flow and the
 * "add root term / add root category" actions. Children render through
 * <TaxonomyNodeRow>.
 */
export function TaxonomyBuilder({
  variable,
  onChangeTree,
  onReplaceVariable,
  importButtonLabel,
  incompleteIds,
  containerInvalid,
  t
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState(false);
  const { mode } = variable.metadata;

  function addRootTerm() {
    onChangeTree((tree) => insertNode(tree, null, createTermNode()));
  }

  function addRootCategory() {
    onChangeTree((tree) => insertNode(tree, null, createCategoryNode()));
  }

  function triggerImport() {
    setImportError(null);
    setImportDone(false);
    fileInputRef.current?.click();
  }

  async function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input so re-selecting the same file fires `change` again.
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const imported = variableFromJson(
        text,
        variable.metadata.displayNameEs,
        variable.metadata.displayNameEn
      );
      onReplaceVariable({
        // Preserve the user's chosen mode unless the import has its own; we
        // also keep their display names if the file didn't carry any.
        metadata: {
          displayNameEs:
            imported.metadata.displayNameEs || variable.metadata.displayNameEs,
          displayNameEn:
            imported.metadata.displayNameEn || variable.metadata.displayNameEn,
          mode: imported.metadata.mode ?? variable.metadata.mode
        },
        nodes: imported.nodes
      });
      // Reemplazar el árbol completo se siente destructivo: sin confirmación
      // el usuario no sabe si el archivo se leyó o si no pasó nada.
      setImportDone(true);
    } catch (error) {
      setImportDone(false);
      const code = error instanceof Error ? error.message : "import_unknown";
      if (code === "invalid_json") {
        setImportError(t.wizard.importErrorInvalidJson);
      } else if (code === "unknown_format") {
        setImportError(t.wizard.importErrorUnknownFormat);
      } else {
        setImportError(t.wizard.importError);
      }
    }
  }

  const termCount = countTerms(variable.nodes);
  const categoryCount = countCategories(variable.nodes);

  return (
    <section className={`taxonomy-builder${containerInvalid ? " is-invalid" : ""}`}>
      <header className="taxonomy-builder-header">
        <div>
          <h4>
            {/* Solo uno de los dos nombres es obligatorio: se muestra el del
                idioma activo y, si falta, el del otro idioma. */}
            {pickLabel(
              t.localeCode,
              variable.metadata.displayNameEs,
              variable.metadata.displayNameEn
            ) || importButtonLabel}
          </h4>
          <p className="help-text" style={{ marginTop: 4 }}>
            {pluralize(categoryCount, t.wizard.taxonomy.summaryCategories, t.wizard.taxonomy.summaryCategoriesSingular)}
            {" · "}
            {pluralize(termCount, t.wizard.taxonomy.summaryTerms, t.wizard.taxonomy.summaryTermsSingular)}
          </p>
        </div>
        <div className="taxonomy-builder-toolbar">
          <button type="button" className="button-secondary" onClick={triggerImport}>
            <Upload size={15} />
            {importButtonLabel}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={onFileSelected}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </header>

      {importError ? (
        <div className="notice notice-danger" role="alert">
          <strong>{t.wizard.importError}</strong>
          <p style={{ margin: 0 }}>{importError}</p>
        </div>
      ) : null}

      {importDone ? (
        <div className="notice" role="status">
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} color="var(--olive)" aria-hidden="true" />
            {t.wizard.importSuccess}
          </p>
        </div>
      ) : null}

      {mode === "flat" && variable.nodes.some((n) => n.kind === "category") ? (
        <div className="notice">
          <p style={{ margin: 0 }}>{t.wizard.taxonomy.flatModeNotice}</p>
        </div>
      ) : null}

      <div className="taxonomy-tree">
        {variable.nodes.length === 0 ? (
          <p className="taxonomy-empty">{t.wizard.taxonomy.emptyState}</p>
        ) : (
          variable.nodes.map((node) => (
            <TaxonomyNodeRow
              key={node.id}
              node={node}
              depth={0}
              mode={mode}
              onChangeTree={onChangeTree}
              incompleteIds={incompleteIds}
              t={t}
            />
          ))
        )}
      </div>

      <div className="taxonomy-root-actions">
        <button type="button" className="button" onClick={addRootTerm}>
          <Plus size={16} />
          {t.wizard.taxonomy.addTerm}
        </button>
        {mode === "hierarchical" ? (
          <button type="button" className="button-secondary" onClick={addRootCategory}>
            <FolderPlus size={16} />
            {t.wizard.taxonomy.addCategory}
          </button>
        ) : null}
      </div>
    </section>
  );
}
