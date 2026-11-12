---
name: t214-protect-confidential-files
description: Enforce least-privilege Supabase Storage bucket policies, keep untrusted uploads in private buckets with type/size validation, and never serve them from the app origin unchecked.
---

# T214: Protect confidential files on operating system or server

**Category:** CODE_FIX
**SD Elements:** [T214](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T214/)
**Priority:** 9

**Spec Context:**
> "Supabase para PostgreSQL, login por e-mail e senha, arquivos" ... "Inclua ... devolução e reembolso"
> Source: specs/PRD.md, lines 5-7, 35-37

**What the spec implies (naive approach):**
A single public bucket holds product images, return-evidence photos and exported reports, with anyone able to list or read it and no checks on file type or size.

**Secure Implementation Pattern:**
```sql
-- supabase/migrations/xxxx_storage.sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true,  2097152, array['image/jpeg','image/png','image/webp']),
  ('return-attachments', 'return-attachments', false, 5242880, array['image/jpeg','image/png','application/pdf']),
  ('reports', 'reports', false, 10485760, array['text/csv']);

create policy "catalog uploads product images" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.current_role() in ('catalog','admin'));
create policy "owners read return attachments" on storage.objects for select
  using (bucket_id = 'return-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "finance reads reports" on storage.objects for select
  using (bucket_id = 'reports' and public.current_role() in ('finance','admin'));
```

**Implementation Guidance:**
- Use separate buckets per sensitivity. Only `product-images` is public.
- Set bucket `file_size_limit` and `allowed_mime_types`. Re-validate magic bytes server-side for PDFs and images.
- Never allow listing of private buckets. Disallow SVG uploads (script risk).
- Serve private files via signed URLs (T50) with `Content-Disposition: attachment`.

**Success Criteria:**
- [ ] Private buckets aren't listable or readable anonymously
- [ ] Oversized or wrong-type uploads are rejected
- [ ] Storage policies are tested for each role

**Status:** Applied

**Implementation (2026-11-12):** The `product-images` bucket (0005) has a 2 MB limit, a JPEG/PNG/WebP allowlist, catalog/admin-only writes and no SELECT policy (no listing). `src/lib/upload.ts` checks that magic bytes match the MIME type and rejects SVG. Unit-tested.
