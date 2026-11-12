import { saveProductAction } from "@/actions/admin";
import { ActionForm, Field, SubmitButton } from "@/components/forms";

interface ProductFormProps {
  categories: { id: string; name: string }[];
  product?: {
    id: string;
    name: string;
    slug: string;
    brand: string;
    description: string;
    category_id: string;
    base_price: number;
    accent: string;
    featured: boolean;
    active: boolean;
  };
}

export function ProductForm({ categories, product }: ProductFormProps) {
  return (
    <ActionForm action={saveProductAction} className="grid gap-4 sm:grid-cols-2">
      {product && <input type="hidden" name="id" value={product.id} />}
      <Field label="Name" name="name" defaultValue={product?.name} required maxLength={120} />
      <Field label="URL slug" name="slug" defaultValue={product?.slug} required maxLength={80} hint="lowercase-letters-and-dashes" />
      <Field label="Brand" name="brand" defaultValue={product?.brand ?? "ACME"} required maxLength={60} />
      <label className="block">
        <span className="label">Category <span className="text-red-600">*</span></span>
        <select name="category_id" className="input" defaultValue={product?.category_id ?? categories[0]?.id} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <Field label="Base price (USD)" name="base_price" type="number" step="0.01" min={0} max={100000} defaultValue={product?.base_price} required />
      <label className="block">
        <span className="label">Accent color</span>
        <input type="color" name="accent" className="h-10 w-full rounded-lg border border-gray-300" defaultValue={product?.accent ?? "#16a34a"} />
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Description (plain text)</span>
        <textarea name="description" className="input" rows={5} maxLength={4000} defaultValue={product?.description} />
      </label>
      <div className="flex gap-6 text-sm sm:col-span-2">
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={product?.active ?? true} /> Visible in store</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} /> Featured</label>
      </div>
      <div className="sm:col-span-2"><SubmitButton pendingText="Saving...">{product ? "Save product" : "Create product"}</SubmitButton></div>
    </ActionForm>
  );
}
