import { z } from "zod";

export const videoUseJobSchema = z.object({
  title: z.string().min(3).max(120),
  sourceUrl: z.string().url(),
  style: z.enum([
    "creator-brand-reel",
    "cqa-product-ad",
    "viral-short",
    "tutorial-clean-cut",
    "cinematic-launch",
  ]),
  platform: z.enum(["tiktok", "instagram-reels", "youtube-shorts", "website"]),
  notes: z.string().max(1200).optional().default(""),
});

export type VideoUseJobInput = z.infer<typeof videoUseJobSchema>;

export type VideoUseWorkerPayload = VideoUseJobInput & {
  jobId: string;
  requestedAt: string;
  brand: "Creative Quality Australia";
  outputPreset: {
    aspectRatio: "9:16" | "16:9";
    resolution: "1080x1920" | "1920x1080";
    captions: boolean;
    removeDeadSpace: boolean;
    removeFillers: boolean;
  };
  prompt: string;
};

export function getVideoUseEnv() {
  return {
    workerUrl: process.env.VIDEO_USE_WORKER_URL,
    workerSecret: process.env.VIDEO_USE_WORKER_SECRET,
  };
}

export function buildVideoUsePrompt(input: VideoUseJobInput) {
  const styleMap: Record<VideoUseJobInput["style"], string> = {
    "creator-brand-reel":
      "Premium creator-brand promo edit: strong first 2 seconds, polished visual pacing, captions, clean cuts, luxury positioning, clear call to action.",
    "cqa-product-ad":
      "CQA digital product ad: direct-response hook, show problem-solution-result, premium neon vending-machine energy, call to action at end.",
    "viral-short":
      "Fast viral short-form edit: aggressive hook, jump cuts, subtitle emphasis, pattern interrupts, retention-first pacing.",
    "tutorial-clean-cut":
      "Clean tutorial edit: remove mistakes, filler words and dead air, keep instructions clear, captions readable, professional pacing.",
    "cinematic-launch":
      "Cinematic product launch edit: premium contrast, launch energy, polished transitions, strong final call to action.",
  };

  return [
    styleMap[input.style],
    `Platform: ${input.platform}`,
    "Required output: final MP4, vertical-first unless platform is website.",
    "Editing rules: remove filler words, remove dead space, add burned-in captions, use short audio fades at cuts, export ready-to-post file.",
    input.notes ? `Creator notes: ${input.notes}` : "Creator notes: none.",
  ].join("\n");
}

export function buildVideoUsePayload(input: VideoUseJobInput): VideoUseWorkerPayload {
  const isWebsite = input.platform === "website";

  return {
    ...input,
    jobId: crypto.randomUUID(),
    requestedAt: new Date().toISOString(),
    brand: "Creative Quality Australia",
    outputPreset: {
      aspectRatio: isWebsite ? "16:9" : "9:16",
      resolution: isWebsite ? "1920x1080" : "1080x1920",
      captions: true,
      removeDeadSpace: true,
      removeFillers: true,
    },
    prompt: buildVideoUsePrompt(input),
  };
}
