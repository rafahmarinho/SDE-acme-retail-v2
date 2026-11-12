---
name: t50-indirect-file-references
description: Reference product images, return attachments and reports in Supabase Storage through database IDs and server-generated object paths or signed URLs, never user-supplied file names.
---

# T50: Use indirect object reference maps if accessing files

**Category:** CODE_FIX
**SD Elements:** [T50](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T50/)
**Priority:** 8

**Spec Context:**
> "Supabase para PostgreSQL, login por e-mail e senha, arquivos e atualizações em tempo real" ... "painel de produtos" ... "devoluções"
> Source: specs/PRD.md, lines 5-7, 25

**What the spec implies (naive approach):**
`/api/files?path=returns/user123/photo.jpg` downloads any storage path, and uploads keep the client's file name (`../../avatar.png`).

**Secure Implementation Pattern:**
```ts
// upload: server picks the object key
export async function createProductImageUpload(productId: string, mime: string) {
  await requirePermission("catalog:write");
  const key = `products/${z.string().uuid().parse(productId)}/${randomUUID()}.${extFor(mime)}`;
  const { data } = await createAdminClient("seed").storage.from("product-images").createSignedUploadUrl(key);
  await db.insert("product_images", { id: randomUUID(), product_id: productId, object_key: key });
  return data; // { signedUrl, token }
}

// download: by DB id -> lookup -> authorize -> short-lived signed URL
export async function getReturnAttachmentUrl(attachmentId: string) {
  const row = await getAttachmentForCurrentUser(attachmentId); // RLS / ownership check (T378)
  const { data } = await (await createServerClient()).storage.from("return-attachments").createSignedUrl(row.object_key, 60);
  return data?.signedUrl;
}
```

**Implementation Guidance:**
- Clients refer to files only by DB IDs. The server maps IDs to object keys.
- Generate object keys server-side (UUIDs) and discard client file names (keep them only as display metadata).
- Private buckets: issue short-lived signed URLs after authorization. Public bucket only for catalog images.

**Success Criteria:**
- [ ] No endpoint accepts a storage path from the client
- [ ] Object keys are server-generated
- [ ] User A cannot obtain a signed URL for user B's attachment

**Status:** Applied

**Implementation (2026-11-12):** `src/services/catalog.ts` `uploadProductImage` generates the key (`products/<productId>/<uuid>.<ext>`). The path regex is enforced in `src/db/storage.ts`, the `products.image_path` CHECK constraint (0001) and the storage insert policy (0005), so the client never supplies a path. There are no private attachments in this release.
