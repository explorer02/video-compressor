/** The list-row key extractor for anything id-shaped, stable across renders by being module-level. */
export function keyById(item: { id: string }): string {
  return item.id;
}
