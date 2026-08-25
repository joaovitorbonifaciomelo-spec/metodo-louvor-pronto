"use client";

import { useState } from "react";
import Link from "next/link";
import { SongAutocomplete } from "@/components/song-autocomplete";
import { CompatibilityList, type CompatibilityResultItem } from "@/components/compatibility-list";
import { Button } from "@/components/ui/button";
import { SkeletonRecommendationList } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics/track";
import { product } from "@/lib/config/product";
import type { Song } from "@/types/song";

/** Demo pré-login (seção 25): primeiro valor, depois cadastro. */
export function DiscoverDemo() {
  const [selected, setSelected] = useState<Song | null>(null);
  const [results, setResults] = useState<CompatibilityResultItem[]>([]);
  const [lockedCount, setLockedCount] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handleSelect(song: Song) {
    setSelected(song);
    setLoading(true);
    track("song_searched", { query: song.title, source: "landing_demo" });
    try {
      const res = await fetch(`/api/songs/${song.id}/compatible?limit=3`);
      const data = await res.json();
      setResults(data.results ?? []);
      setLockedCount(data.lockedCount ?? 0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6">
      <div className="w-full">
        <SongAutocomplete onSelect={handleSelect} placeholder="Ex.: Bondade de Deus" />
      </div>

      {loading && (
        <div className="w-full">
          <SkeletonRecommendationList count={3} />
        </div>
      )}

      {!loading && selected && results.length > 0 && (
        <div className="w-full animate-fade-in-up">
          <p className="mb-3 text-center text-sm text-base-400">
            Medleys sugeridos para <span className="text-base-100">{selected.title}</span>:
          </p>
          <CompatibilityList results={results} />
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-6 text-center">
            <p className="text-sm text-base-200">
              {lockedCount > 0
                ? `+${lockedCount} medley${lockedCount > 1 ? "s" : ""} bloqueado${lockedCount > 1 ? "s" : ""}. `
                : ""}
              Assine o {product.name} para ver todos os medleys e montar o repertório completo.
            </p>
            <Button onClick={() => (window.location.href = "/signup")}>Assinar {product.name}</Button>
          </div>
        </div>
      )}

      {!loading && selected && results.length === 0 && (
        <div className="w-full rounded-2xl border border-base-800 bg-base-900 p-6 text-center text-sm text-base-400">
          Ainda não temos músicas suficientes no catálogo para sugerir um medley forte para essa escolha.{" "}
          <Link href="/signup" className="text-accent underline">
            Crie sua conta
          </Link>{" "}
          para solicitar novas músicas.
        </div>
      )}
    </div>
  );
}
