"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/card";
import type { Song } from "@/types/song";

interface SongAutocompleteProps {
  placeholder?: string;
  onSelect: (song: Song) => void;
  autoFocus?: boolean;
  emptyAction?: (query: string) => React.ReactNode;
}

/** Busca com debounce (seção 31): "Bonda..." já sugere "Bondade de Deus". */
export function SongAutocomplete({
  placeholder = "Digite o nome de um louvor…",
  onSelect,
  autoFocus,
  emptyAction,
}: SongAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      fetch(`/api/songs/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          setResults(data.songs ?? []);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="py-3.5 text-base"
        />
        {loading && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base-400">
            <Spinner />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-base-700 bg-base-850 shadow-xl">
          {results.map((song) => (
            <li key={song.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-base-800"
                onClick={() => {
                  onSelect(song);
                  setQuery(song.title);
                  setOpen(false);
                }}
              >
                <span className="text-sm font-medium text-base-100">{song.title}</span>
                {song.artist && <span className="text-xs text-base-400">{song.artist}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-base-700 bg-base-850 px-4 py-3 text-sm text-base-400 shadow-xl">
          <p>
            Nenhuma música encontrada para &ldquo;{query}&rdquo;.
          </p>
          {emptyAction?.(query.trim())}
        </div>
      )}
    </div>
  );
}
