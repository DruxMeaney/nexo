"use client";

import { useId } from "react";
import {
  ArrowDown,
  ArrowUp,
  FolderPlus,
  Plus,
  Trash2
} from "lucide-react";
import {
  createCategoryNode,
  createTermNode,
  insertNode,
  moveNode,
  removeNode,
  updateNode
} from "@/lib/protocol/draft";
import type { TaxonomyMode, TaxonomyNode } from "@/lib/protocol/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface Props {
  node: TaxonomyNode;
  depth: number;
  mode: TaxonomyMode;
  onChangeTree: (updater: (tree: TaxonomyNode[]) => TaxonomyNode[]) => void;
  /**
   * IDs of term nodes the wizard flagged as incomplete (missing label or
   * patterns). Used to paint just those rows in red, without re-validating
   * inside each row.
   */
  incompleteIds: Set<string>;
  t: Dictionary;
}

/**
 * Renders a single node — either a term (leaf with patterns) or a category
 * (group with children). Categories recurse into their children using the
 * same component.
 *
 * All edits are dispatched through `onChangeTree`, which the parent uses to
 * rebuild the variable's tree immutably.
 */
export function TaxonomyNodeRow({
  node,
  depth,
  mode,
  onChangeTree,
  incompleteIds,
  t
}: Props) {
  const reactId = useId();
  const idPrefix = `node-${node.id}-${reactId}`;

  function patch(updates: Partial<TaxonomyNode>) {
    onChangeTree((tree) => updateNode(tree, node.id, updates));
  }

  function onDelete() {
    if (window.confirm(t.wizard.taxonomy.confirmDelete)) {
      onChangeTree((tree) => removeNode(tree, node.id));
    }
  }

  function onMove(direction: -1 | 1) {
    onChangeTree((tree) => moveNode(tree, node.id, direction));
  }

  function onAddChildTerm() {
    onChangeTree((tree) => insertNode(tree, node.id, createTermNode()));
  }

  function onAddChildCategory() {
    onChangeTree((tree) => insertNode(tree, node.id, createCategoryNode()));
  }

  const isCategory = node.kind === "category";
  const isTerm = node.kind === "term";
  const isInvalid = isTerm && incompleteIds.has(node.id);

  return (
    <div
      className={`taxonomy-node taxonomy-node-${node.kind}${isInvalid ? " is-invalid" : ""}`}
      style={{ marginLeft: depth === 0 ? 0 : 16 }}
    >
      <header className="taxonomy-node-header">
        <span
          className={`taxonomy-node-kind ${isCategory ? "is-category" : "is-term"}`}
        >
          {isCategory ? t.wizard.taxonomy.kindCategory : t.wizard.taxonomy.kindTerm}
        </span>
        <div className="taxonomy-node-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={t.wizard.taxonomy.moveUp}
            title={t.wizard.taxonomy.moveUp}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t.wizard.taxonomy.moveDown}
            title={t.wizard.taxonomy.moveDown}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            className="icon-button danger"
            aria-label={t.wizard.taxonomy.deleteNode}
            title={t.wizard.taxonomy.deleteNode}
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      <div className="form-grid taxonomy-node-grid">
        <div className="field">
          <label htmlFor={`${idPrefix}-es`}>{t.wizard.taxonomy.fieldLabelEs}</label>
          <input
            id={`${idPrefix}-es`}
            type="text"
            value={node.labelEs}
            onChange={(e) => patch({ labelEs: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-en`}>{t.wizard.taxonomy.fieldLabelEn}</label>
          <input
            id={`${idPrefix}-en`}
            type="text"
            value={node.labelEn}
            onChange={(e) => patch({ labelEn: e.target.value })}
          />
        </div>

        {isTerm ? (
          <>
            <div className="field full">
              <label htmlFor={`${idPrefix}-patterns`}>
                {t.wizard.taxonomy.fieldPatterns}
              </label>
              <textarea
                id={`${idPrefix}-patterns`}
                value={node.patterns.join("\n")}
                onChange={(e) =>
                  patch({
                    patterns: e.target.value
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean)
                  })
                }
                rows={Math.max(3, Math.min(8, node.patterns.length + 1))}
                spellCheck={false}
              />
              <p className="help-text">{t.wizard.taxonomy.fieldPatternsHint}</p>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={node.generic}
                onChange={(e) => patch({ generic: e.target.checked })}
              />
              <span>
                {t.wizard.taxonomy.fieldGeneric}{" "}
                <span className="muted">— {t.wizard.taxonomy.fieldGenericHint}</span>
              </span>
            </label>
          </>
        ) : null}
      </div>

      {isCategory ? (
        <>
          <div className="taxonomy-children">
            {node.children.length === 0 ? (
              <p className="taxonomy-empty">{t.wizard.taxonomy.emptyState}</p>
            ) : (
              node.children.map((child) => (
                <TaxonomyNodeRow
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  mode={mode}
                  onChangeTree={onChangeTree}
                  incompleteIds={incompleteIds}
                  t={t}
                />
              ))
            )}
          </div>
          <div className="taxonomy-node-add">
            <button
              type="button"
              className="button-secondary"
              onClick={onAddChildTerm}
            >
              <Plus size={15} />
              {t.wizard.taxonomy.addTermHere}
            </button>
            {mode === "hierarchical" ? (
              <button
                type="button"
                className="button-secondary"
                onClick={onAddChildCategory}
              >
                <FolderPlus size={15} />
                {t.wizard.taxonomy.addSubcategory}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
