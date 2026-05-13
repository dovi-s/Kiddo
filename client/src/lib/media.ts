const ALLOWED_VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com", "loom.com"];

function parseUrl(input: string | null | undefined): URL | null {
  if (!input) return null;
  try {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("/")) {
      return new URL(trimmed, "http://local");
    }
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

export function isSafeImageUrl(input: string | null | undefined): boolean {
  return !!parseUrl(input);
}

export function getEmbedVideoUrl(input: string | null | undefined): string | null {
  const url = parseUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (!ALLOWED_VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;

  if (host.includes("youtube.com")) {
    const v = url.searchParams.get("v");
    return v ? `https://www.youtube.com/embed/${v}` : null;
  }
  if (host.includes("youtu.be")) {
    const id = url.pathname.replace("/", "");
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host.includes("vimeo.com")) {
    const id = url.pathname.split("/").filter(Boolean).pop();
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host.includes("loom.com")) {
    const id = url.pathname.split("/").filter(Boolean).pop();
    return id ? `https://www.loom.com/embed/${id}` : null;
  }
  return null;
}
