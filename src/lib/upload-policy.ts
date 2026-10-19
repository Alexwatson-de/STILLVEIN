// Build-time policy shared by browser validation and the trusted upload API.
// Vercel is configured to 4 MB, below its 4.5 MB request-body ceiling. Other
// explicitly configured hosts retain the original 10 MB maximum.
const configured = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_MB || '10');
export const MAX_IMAGE_MB =
  Number.isFinite(configured) && configured >= 1 && configured <= 10 ? configured : 10;
export const MAX_IMAGE_BYTES = Math.floor(MAX_IMAGE_MB * 1024 * 1024);
