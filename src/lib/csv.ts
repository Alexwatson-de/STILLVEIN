import Papa from 'papaparse';
import { Product, productSchema, ProductInput } from './schema';
import { safeCsv } from './catalog';
export function exportProducts(products: Product[]) {
  return Papa.unparse(
    products.map((p) => ({
      id: p.id,
      name: safeCsv(p.name),
      sku: safeCsv(p.sku),
      status: p.status,
      product_json: JSON.stringify(productSchema.parse(p)),
    })),
  );
}
export function importProducts(csv: string): { id?: string; product: ProductInput }[] {
  if (csv.length > 2000000) throw new Error('CSV is limited to 2 MB.');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(parsed.errors.map((e) => e.message).join('; '));
  if (!parsed.data.length || parsed.data.length > 100)
    throw new Error('Import 1–100 rows at a time.');
  return parsed.data.map((row, i) => {
    try {
      const product = productSchema.parse(JSON.parse(row.product_json));
      return { id: row.id || undefined, product };
    } catch (e) {
      throw new Error(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Invalid product JSON'}`);
    }
  });
}
export function exportEnquiries(rows: Record<string, unknown>[]) {
  return Papa.unparse(
    rows.map((e) =>
      Object.fromEntries(
        [
          'reference',
          'name',
          'email',
          'phone',
          'company',
          'productName',
          'sku',
          'quantity',
          'unit',
          'message',
          'status',
          'assignedTo',
          'followUp',
          'createdAt',
        ].map((k) => [k, safeCsv(e[k])]),
      ),
    ),
  );
}
