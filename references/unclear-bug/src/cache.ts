export type Product = { id: string; names: Record<string, string>; tags: string[] };
export type RenderedProduct = { label: string; tags: string[] };

const cache = new Map<string, RenderedProduct>();

export function renderProduct(product: Product, locale: string) {
  const key = `${product.id}\0${locale}`;
  let rendered = cache.get(key);
  if (!rendered) {
    rendered = { label: product.names[locale] ?? product.names.en, tags: [...product.tags] };
    cache.set(key, rendered);
  }
  return { ...rendered, tags: [...rendered.tags] };
}

export function clearCache() {
  cache.clear();
}
