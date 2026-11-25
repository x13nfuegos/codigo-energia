import type { Metadata } from "next";
import { after } from "next/server";
import { SectionTitle } from "@/components/Cards";
import { PodcastPlayer } from "@/components/PodcastPlayer";
import { sortedEpisodes } from "@/lib/podcast";
import { enrichPodcast } from "@/lib/podcast-store";
import { getSettings } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: s.podcast?.title ?? "Podcast", description: s.podcast?.description };
}

export default async function PodcastPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const settings = await getSettings();
  const podcast = settings.podcast;
  if (podcast?.episodes.length) {
    after(async () => enrichPodcast(podcast));
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
