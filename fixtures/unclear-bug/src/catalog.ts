import { renderProduct, type Product } from "./cache";

export function catalogLabel(product: Product, locale: string) {
  return renderProduct(product, locale).label;
}
