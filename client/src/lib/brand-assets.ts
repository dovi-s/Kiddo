import mascotDefault from "@/assets/kora-mascot.png";
import mascotPlanting from "@/assets/kora-mascot-planting.png";

export type MascotVariant = "default" | "planting";

type MascotAsset = {
  staticSrc: string;
  animatedSrc: string | null;
};

function envValue(name: string) {
  const value = (import.meta.env[name] as string | undefined) || "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const founderMedia = {
  name: envValue("VITE_FOUNDER_NAME") || "Founding team",
  title: envValue("VITE_FOUNDER_TITLE") || "Why we built Kiddo",
  photoUrl: envValue("VITE_FOUNDER_PHOTO_URL"),
  videoUrl: envValue("VITE_FOUNDER_VIDEO_URL"),
  story:
    envValue("VITE_FOUNDER_STORY") ||
    "Add a real founder photo and a short origin video here as soon as those assets exist. This section is already wired to publish them without another code pass.",
};

export const mascotAssets: Record<MascotVariant, MascotAsset> = {
  default: {
    staticSrc: mascotDefault,
    animatedSrc: envValue("VITE_PIP_DEFAULT_ANIMATION_URL"),
  },
  planting: {
    staticSrc: mascotPlanting,
    animatedSrc: envValue("VITE_PIP_PLANTING_ANIMATION_URL"),
  },
};

