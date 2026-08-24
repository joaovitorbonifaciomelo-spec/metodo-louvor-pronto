"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SongAutocomplete } from "@/components/song-autocomplete";
import { SongRequestButton } from "@/components/song-request-button";
import { CompatibilityList, type CompatibilityResultItem } from "@/components/compatibility-list";
import { Spinner } from "@/components/ui/card";
import { track } from "@/lib/analytics/track";
import type { Song } from "@/types/song";

export function BuscarClient() {
  const router = useRouter();
  const [selected, setSelected] = useState<Song | null>(null);
  const [results, setResults] = useState<CompatibilityResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(5);

  async function loadResults(song: Song, nextLimit: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/songs/${song.id}/compatible?limit=${nextLimit}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(song: Song) {
    setSelected(song);
    setLimit(5);
    track("recommendation_clicked", { songId: song.id });
    await loadResults(song, 5);
  }

  function handleCreateSetlist(song: Song) {
    router.push(`/cultos/novo?mandatorySongId=${song.id}&mandatorySongTitle=${encodeURIComponent(song.title)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-base-50">Descubra quais músicas combinam</h1>
        <p className="mt-1 text-sm text-base-400">
          Digite um louvor que você já escolheu — mostramos as melhores opções para continuar o repertório.
        </p>
      </div>

      <SongAutocomplete
        onSelect={handleSelect}
        autoFocus
        emptyAction={(query) => <SongRequestButton query={query} />}
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-base-400">
          <Spinner /> Calculando compatibilidade…
        </div>
      )}

      {!loading && selected && (
        <div>
          <p className="mb-3 text-sm text-base-400">
            Músicas que combinam com <span className="text-base-100">{selected.title}</span>:
          </p>
          <CompatibilityList
            results={results}
            primaryActionLabel="Criar repertório com esta música"
            onPrimaryAction={handleCreateSetlist}
          />
          {results.length > 0 && results.length === limit && limit < 15 && (
            <button
              type="button"
              className="mt-4 text-sm text-accent hover:underline"
              onClick={() => {
                const next = limit + 5;
                setLimit(next);
                loadResults(selected, next);
              }}
            >
              Ver mais opções
            </button>
          )}
        </div>
      )}
    </div>
  );
}
