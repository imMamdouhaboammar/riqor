export type Product = { id: string; names: Record<string, string>; tags: string[] };
export type RenderedProduct = { label: string; tags: string[] };

const cache = new Map<string, RenderedProduct>();

export function renderProduct(product: Product, locale: string) {
  const cached = cache.get(product.id);
  if (cached) return cached;
  const rendered = { label: product.names[locale] ?? product.names.en, tags: product.tags };
  cache.set(product.id, rendered);
  return rendered;
}

export function clearCache() {
  cache.clear();
}
