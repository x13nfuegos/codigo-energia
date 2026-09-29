import type { Metadata } from "next";
import { after } from "next/server";
import { SectionTitle } from "@/components/Cards";
import { PodcastPlayer } from "@/components/PodcastPlayer";
import { enrichPodcast, sortedEpisodes } from "@/lib/podcast";
import { getSettings } from "@/lib/site";
import { getStore } from "@/lib/store";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: s.podcast?.title ?? "Podcast", description: s.podcast?.description };
}

export default async function PodcastPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const settings = await getSettings();
  const podcast = settings.podcast;
  if (podcast?.episodes.some((e) => !e.meta_ok)) {
    after(async () => enrichPodcast(podcast, async (p) => (await getStore()).saveSettings({ podcast: p })));
  }
  const episodes = podcast ? sortedEpisodes(podcast) : [];
  return (
    <div>
      <SectionTitle title={podcast?.title ?? "Podcast"} />
      {podcast?.description && <p className="-mt-2 mb-8 max-w-3xl text-lg text-muted">{podcast.description}</p>}
      {episodes.length ? <PodcastPlayer episodes={episodes} initial={(await searchParams).e} /> : <p className="text-muted">Pronto, el primer episodio.</p>}
    </div>
  );
}
