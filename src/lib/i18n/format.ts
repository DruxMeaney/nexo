/**
 * Small i18n helpers shared across the UI.
 *
 * The dictionary pattern: each plural-aware key has a `xxxSingular` sibling
 * that the helper picks when `count === 1`. Falls back to the plural form
 * (replacing `{count}`) for any other count, including zero.
 */

export function pluralize(
  count: number,
  pluralTemplate: string,
  singular: string
): string {
  if (count === 1) return singular;
  return pluralTemplate.replace("{count}", String(count));
}
