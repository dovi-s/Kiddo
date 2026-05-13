import { PlayCircle, UserRound } from "lucide-react";
import { founderMedia } from "@/lib/brand-assets";

export function FounderMedia() {
  const hasPhoto = Boolean(founderMedia.photoUrl);
  const hasVideo = Boolean(founderMedia.videoUrl);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-premium-sm">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
          {hasPhoto ? (
            <img
              src={founderMedia.photoUrl!}
              alt={founderMedia.name}
              className="h-[320px] w-full object-cover"
              data-testid="img-founder-photo"
            />
          ) : (
            <div className="flex h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <UserRound className="h-6 w-6 text-primary" />
              </div>
              <p className="text-base font-medium text-foreground">Founder photo slot</p>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Set `VITE_FOUNDER_PHOTO_URL` when the real photo is ready. This section will publish it automatically.
              </p>
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm font-semibold text-primary">{founderMedia.name}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{founderMedia.title}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{founderMedia.story}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-premium-sm">
        <p className="text-sm font-semibold text-primary">Founder video</p>
        <p className="mt-2 text-lg font-semibold text-foreground">A real explanation beats polished filler.</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          A short origin video belongs here when it exists. One clear minute about why Kiddo was built will do more for trust than generic marketing copy.
        </p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-border/60 bg-muted/30">
          {hasVideo ? (
            <div className="aspect-video">
              <iframe
                src={founderMedia.videoUrl!}
                title="Founder story"
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                data-testid="frame-founder-video"
              />
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center">
              <PlayCircle className="h-10 w-10 text-primary" />
              <p className="text-base font-medium text-foreground">Founder video slot</p>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Set `VITE_FOUNDER_VIDEO_URL` when the hosted video is ready. Vimeo or another clean embed works well here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

