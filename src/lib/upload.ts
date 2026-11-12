/**
 * Upload validation for product images (T214): size, declared MIME AND magic bytes must agree.
 * SVG is never accepted (script risk). Object keys are generated server-side (T50).
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const SIGNATURES: { mime: string; ext: "jpg" | "png" | "webp"; test: (b: Uint8Array) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    ext: "png",
    test: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  },
  {
    mime: "image/webp",
    ext: "webp",
    test: (b) =>
      String.fromCharCode(b[0], b[1], b[2], b[3]) === "RIFF" && String.fromCharCode(b[8], b[9], b[10], b[11]) === "WEBP",
  },
];

export function detectImage(bytes: Uint8Array, declaredMime: string): { mime: string; ext: "jpg" | "png" | "webp" } | null {
  if (bytes.byteLength < 12 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  const sig = SIGNATURES.find((s) => s.test(bytes));
  if (!sig || sig.mime !== declaredMime) return null;
  return { mime: sig.mime, ext: sig.ext };
}
