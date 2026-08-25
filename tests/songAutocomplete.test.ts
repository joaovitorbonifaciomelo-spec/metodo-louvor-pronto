import { describe, expect, it } from "vitest";
import { autocompleteReducer, initialAutocompleteState, type AutocompleteState } from "@/components/song-autocomplete";
import type { Song } from "@/types/song";

/**
 * Testa o fluxo real do bug reportado em "Encontrar medleys": selecionar uma
 * música reabria o dropdown por cima dos cards de resultado assim que a
 * busca (reacionada por `query = song.title`) respondia. As regras vivem em
 * `autocompleteReducer` (puro), extraídas do componente exatamente para
 * serem testáveis sem precisar renderizar DOM.
 */

const SONG_A: Song = {
  id: "song-a",
  title: "A Ele a Glória",
  artist: null,
  version: null,
  key: null,
  capo: null,
  difficulty: null,
  energy: null,
  bpm: null,
  moments: [],
  themes: [],
  tags: [],
  youtubeUrl: null,
  spotifyUrl: null,
  active: true,
  reviewRequired: false,
  youtubeVideoId: null,
  youtubeTitle: null,
  youtubeChannel: null,
  youtubeThumbnail: null,
  youtubeVerifiedAt: null,
  youtubeStatus: "pending",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const SONG_B: Song = { ...SONG_A, id: "song-b", title: "Bondade de Deus" };

function withResults(state: AutocompleteState, songs: Song[]): AutocompleteState {
  return autocompleteReducer(state, { type: "RESULTS_LOADED", songs });
}

describe("fluxo real: digitar -> selecionar -> medleys carregados -> editar de novo", () => {
  it("digitar música -> dropdown visível (resultados chegam, open=true)", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = withResults(state, [SONG_A]);
    expect(state.open).toBe(true);
    expect(state.results).toEqual([SONG_A]);
  });

  it("selecionar opção -> dropdown oculto imediatamente", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = withResults(state, [SONG_A]);
    expect(state.open).toBe(true);

    state = autocompleteReducer(state, { type: "SELECT", song: SONG_A });
    expect(state.open).toBe(false);
    expect(state.selectedSong).toEqual(SONG_A);
    expect(state.query).toBe("A Ele a Glória");
    expect(state.results).toEqual([]); // não deve sobrar lista cobrindo os cards
  });

  it("BUG ORIGINAL: uma resposta de busca que chega DEPOIS da seleção (para o mesmo texto) não reabre o dropdown", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = autocompleteReducer(state, { type: "SELECT", song: SONG_A });
    expect(state.open).toBe(false);

    // Simula a busca reacionada por `query = song.title` (o efeito colateral
    // que causava o bug) respondendo com resultados — não pode reabrir,
    // porque `query` ainda bate exatamente com `selectedSong.title`.
    state = withResults(state, [SONG_A, SONG_B]);
    expect(state.open).toBe(false);
  });

  it("medleys carregados (nenhuma ação de autocomplete) -> dropdown continua oculto", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = autocompleteReducer(state, { type: "SELECT", song: SONG_A });
    // Nenhuma ação do autocomplete acontece enquanto os medleys carregam —
    // o estado simplesmente permanece como ficou após a seleção.
    expect(state.open).toBe(false);
    expect(state.selectedSong).toEqual(SONG_A);
  });

  it("editar o texto depois da seleção -> selectedSong é limpo e o dropdown volta a funcionar", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = autocompleteReducer(state, { type: "SELECT", song: SONG_A });
    expect(state.selectedSong).toEqual(SONG_A);

    // Usuário apaga parte do texto: "A Ele a Glória" -> "A Ele..."
    state = autocompleteReducer(state, { type: "QUERY_CHANGED", value: "A Ele..." });
    expect(state.selectedSong).toBeNull(); // seleção invalidada

    state = withResults(state, [SONG_A]);
    expect(state.open).toBe(true); // volta a funcionar normalmente
  });

  it("editar mantendo o texto EXATAMENTE igual ao título selecionado não invalida a seleção", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = autocompleteReducer(state, { type: "SELECT", song: SONG_A });
    state = autocompleteReducer(state, { type: "QUERY_CHANGED", value: "A Ele a Glória" });
    expect(state.selectedSong).toEqual(SONG_A);
  });
});

describe("Escape e clique fora", () => {
  it("Escape fecha o dropdown sem apagar a música selecionada", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = withResults(state, [SONG_A]);
    state = autocompleteReducer(state, { type: "SELECT", song: SONG_A });
    state = withResults(state, [SONG_A]); // reabriria se não fosse pela seleção — confirma que já está fechado
    expect(state.open).toBe(false);

    // Ainda buscando (sem seleção válida): Escape fecha.
    let searching = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    searching = withResults(searching, [SONG_A]);
    expect(searching.open).toBe(true);
    searching = autocompleteReducer(searching, { type: "ESCAPE" });
    expect(searching.open).toBe(false);
    expect(searching.query).toBe("A Ele"); // não mexe no texto
  });

  it("clique fora fecha o dropdown sem apagar a música selecionada", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = withResults(state, [SONG_A]);
    state = autocompleteReducer(state, { type: "CLICK_OUTSIDE" });
    expect(state.open).toBe(false);
    expect(state.query).toBe("A Ele");
  });
});

describe("FOCUS — seleção tem prioridade sobre focus", () => {
  it("focar o campo depois de selecionar NÃO reabre o dropdown, mesmo com resultados antigos em memória", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = withResults(state, [SONG_A]);
    state = autocompleteReducer(state, { type: "SELECT", song: SONG_A });

    state = autocompleteReducer(state, { type: "FOCUS" });
    expect(state.open).toBe(false);
  });

  it("focar o campo durante uma busca ativa (sem seleção válida) reabre se já houver resultados", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = withResults(state, [SONG_A]);
    state = autocompleteReducer(state, { type: "CLICK_OUTSIDE" }); // fecha, ex.: clique fora
    expect(state.open).toBe(false);

    state = autocompleteReducer(state, { type: "FOCUS" });
    expect(state.open).toBe(true);
  });

  it("focar sem nenhum resultado carregado não abre nada", () => {
    const state = autocompleteReducer(initialAutocompleteState, { type: "FOCUS" });
    expect(state.open).toBe(false);
  });
});

describe("SEARCH_FAILED", () => {
  it("erro de busca limpa os resultados sem forçar abertura do dropdown", () => {
    let state = autocompleteReducer(initialAutocompleteState, { type: "QUERY_CHANGED", value: "A Ele" });
    state = autocompleteReducer(state, { type: "CLICK_OUTSIDE" }); // garante open=false
    state = autocompleteReducer(state, { type: "SEARCH_FAILED" });
    expect(state.open).toBe(false);
    expect(state.results).toEqual([]);
  });
});
