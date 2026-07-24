export const DEFAULT_MIRROR_DESCRIPTION =
  "Managed by Hydrozoa — mirrored from {url}";

export type MirrorDescriptionMode = "default" | "custom" | "none";

function sanitizeDescription(value: string): string {
  return value
    .replace(/[\x00-\x1F\x7F-\x9F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildMirrorDescription(
  sourceDescription: string | null | undefined,
  sourceUrl: string | undefined,
  repositoryName: string,
  mode: MirrorDescriptionMode,
  customTemplate: string | null | undefined
): string {
  const base = sanitizeDescription(sourceDescription || "");
  if (mode === "none") return base.slice(0, 255);

  const template = mode === "custom"
    ? sanitizeDescription(customTemplate || "")
    : DEFAULT_MIRROR_DESCRIPTION;
  if (!template) return base.slice(0, 255);

  const suffix = sanitizeDescription(
    template
      .replaceAll("{url}", sourceUrl || repositoryName)
      .replaceAll("{repo}", repositoryName)
  );
  if (!suffix || base.includes(suffix)) return base.slice(0, 255);
  if (!base) return suffix.slice(0, 255);
  return `${base} — ${suffix}`.slice(0, 255);
}
