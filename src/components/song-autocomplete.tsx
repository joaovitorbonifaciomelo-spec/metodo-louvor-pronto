"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/card";
import type { Song } from "@/types/song";

interface SongAutocompleteProps {
  placeholder?: string;
  onSelect: (song: Song) => void;
  autoFocus?: boolean;
  emptyAction?: (query: string) => React.ReactNode;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isQuerySameAsSelection(candidateQuery: string, song: Song | null): boolean {
  return Boolean(song) && normalize(candidateQuery) === normalize(song!.title);
}

export interface AutocompleteState {
  query: string;
  selectedSong: Song | null;
  open: boolean;
  results: Song[];
}

export type AutocompleteAction =
  | { type: "QUERY_CHANGED"; value: string }
  | { type: "RESULTS_LOADED"; songs: Song[] }
  | { type: "SEARCH_FAILED" }
  | { type: "SELECT"; song: Song }
  | { type: "FOCUS" }
  | { type: "ESCAPE" }
  | { type: "CLICK_OUTSIDE" };

export const initialAutocompleteState: AutocompleteState = {
  query: "",
  selectedSong: null,
  open: false,
  results: [],
};

/**
 * Regras de estado do autocomplete, isoladas do efeito colateral de rede —
 * testável sem DOM (ver tests/songAutocomplete.test.ts). Esta é a peça que
 * continha o bug original: selecionar uma música fazia `query = song.title`,
 * o que reacionava a busca e reabria o dropdown por cima dos resultados
 * assim que ela respondia. Regra central: enquanto `query` continuar batendo
 * com `selectedSong.title`, isso é efeito colateral da própria seleção, não
 * uma nova intenção de pesquisar — o dropdown não reabre nesse caso.
 */
export function autocompleteReducer(state: AutocompleteState, action: AutocompleteAction): AutocompleteState {
  switch (action.type) {
    case "QUERY_CHANGED": {
      const value = action.value;
      // Editar o texto de forma que ele deixe de bater com a música
      // selecionada invalida a seleção — volta ao modo de pesquisa.
      const stillMatchesSelection = isQuerySameAsSelection(value, state.selectedSong);
      return {
        ...state,
        query: value,
        selectedSong: stillMatchesSelection ? state.selectedSong : null,
        results: normalize(value).length < 2 ? [] : state.results,
      };
    }

    case "RESULTS_LOADED": {
      // Se enquanto a busca estava a caminho o texto voltou a bater com uma
      // seleção válida, isso não é mais uma pesquisa em andamento — não abre.
      // Abre mesmo com 0 resultados (mostra "nenhuma música encontrada") —
      // só não abre quando a resposta não corresponde mais a uma busca ativa.
      const stillSearching = !isQuerySameAsSelection(state.query, state.selectedSong);
      return { ...state, results: action.songs, open: stillSearching ? true : state.open };
    }

    case "SEARCH_FAILED":
      // Erro de rede: só limpa os resultados, sem forçar abertura (igual ao
      // comportamento original — um erro não deveria "empurrar" o dropdown).
      return { ...state, results: [] };

    case "SELECT":
      return { ...state, selectedSong: action.song, query: action.song.title, results: [], open: false };

    case "FOCUS": {
      // Seleção tem prioridade sobre focus: só reabre se ainda fizer sentido
      // pesquisar (sem seleção válida para o texto atual) e houver resultados.
      if (isQuerySameAsSelection(state.query, state.selectedSong)) return state;
      return state.results.length > 0 ? { ...state, open: true } : state;
    }

    case "ESCAPE":
    case "CLICK_OUTSIDE":
      return { ...state, open: false };

    default:
      return state;
  }
}

/**
 * Busca com debounce (seção 31): "Bonda..." já sugere "Bondade de Deus".
 * Cache em memória por normalizedQuery evita repetir a mesma request de
 * rede ao apagar/redigitar, e um AbortController descarta respostas de
 * buscas antigas que chegam fora de ordem — sem isso, digitar rápido podia
 * fazer um resultado antigo "piscar" por cima do mais recente.
 *
 * As regras de abrir/fechar/selecionar em si ficam em `autocompleteReducer`
 * (puro, testável); este componente só dispara os efeitos de rede e
 * despacha as ações correspondentes.
 */
export function SongAutocomplete({
  placeholder = "Digite o nome de um louvor…",
  onSelect,
  autoFocus,
  emptyAction,
}: SongAutocompleteProps) {
  const [state, dispatch] = useReducer(autocompleteReducer, initialAutocompleteState);
  const { query, selectedSong, open, results } = state;
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, Song[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  // Espelham o estado mais recente em refs para a checagem de "ainda é
  // relevante?" dentro do callback assíncrono do fetch (uma resposta pode
  // chegar bem depois de uma seleção já ter acontecido).
  const queryRef = useRef(query);
  const selectedSongRef = useRef(selectedSong);
  useEffect(() => {
    queryRef.current = query;
    selectedSongRef.current = selectedSong;
  }, [query, selectedSong]);

  useEffect(() => {
    if (isQuerySameAsSelection(query, selectedSong)) return;

    const normalized = normalize(query);
    if (normalized.length < 2) return;

    const cached = cacheRef.current.get(normalized);
    if (cached) {
      dispatch({ type: "RESULTS_LOADED", songs: cached });
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/songs/search?q=${encodeURIComponent(normalized)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          const songs: Song[] = data.songs ?? [];
          cacheRef.current.set(normalized, songs);
          if (abortRef.current !== controller) return; // resposta de uma busca já substituída
          if (isQuerySameAsSelection(queryRef.current, selectedSongRef.current)) return; // seleção aconteceu enquanto buscava
          dispatch({ type: "RESULTS_LOADED", songs });
        })
        .catch((err) => {
          if (err?.name !== "AbortError") dispatch({ type: "SEARCH_FAILED" });
        })
        .finally(() => {
          if (abortRef.current === controller) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [query, selectedSong]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        dispatch({ type: "CLICK_OUTSIDE" });
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectSong(song: Song) {
    onSelect(song);
    dispatch({ type: "SELECT", song });
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => dispatch({ type: "QUERY_CHANGED", value: e.target.value })}
          onFocus={() => dispatch({ type: "FOCUS" })}
          onKeyDown={(e) => e.key === "Escape" && dispatch({ type: "ESCAPE" })}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="py-3.5"
        />
        {loading && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base-400">
            <Spinner />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="scrollbar-thin animate-fade-in absolute z-20 mt-2 max-h-[60vh] w-full overflow-y-auto overscroll-contain rounded-xl border border-base-700 bg-base-850 shadow-xl">
          {results.map((song) => (
            <li key={song.id}>
              <button
                type="button"
                className="flex min-h-[56px] w-full flex-col items-start justify-center gap-0.5 px-4 py-3 text-left transition-colors active:bg-base-800 sm:hover:bg-base-800"
                onClick={() => selectSong(song)}
              >
                <span className="text-[15px] font-medium text-base-100">{song.title}</span>
                {song.artist && <span className="text-xs text-base-400">{song.artist}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="animate-fade-in absolute z-20 mt-2 w-full rounded-xl border border-base-700 bg-base-850 px-4 py-3 text-sm text-base-400 shadow-xl">
          <p>
            Nenhuma música encontrada para &ldquo;{query}&rdquo;.
          </p>
          {emptyAction?.(query.trim())}
        </div>
      )}
    </div>
  );
}
