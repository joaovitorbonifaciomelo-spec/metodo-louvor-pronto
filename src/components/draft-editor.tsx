"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, Spinner } from "@/components/ui/card";
import { SongAutocomplete } from "@/components/song-autocomplete";
import { MOMENTS } from "@/types/song";
import { cn } from "@/lib/utils";
import type { DraftSetlistItem } from "@/types/draft";
import type { Song } from "@/types/song";

const REMOVE_TRANSITION_MS = 180;

function AddSongToDraftForm({ onAdd }: { onAdd: (song: Song, moment: string) => void }) {
  const [moment, setMoment] = useState<string>(MOMENTS[0]);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select value={moment} onChange={(e) => setMoment(e.target.value)} className="sm:w-48">
        {MOMENTS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>
      <div className="flex-1">
        <SongAutocomplete onSelect={(song) => onAdd(song, moment)} placeholder="Adicionar música…" />
      </div>
    </div>
  );
}

interface DraftEditorProps {
  draft: DraftSetlistItem[];
  setDraft: React.Dispatch<React.SetStateAction<DraftSetlistItem[]>>;
  onAddSong: (song: Song, moment: string) => void;
  onRegenerate: () => void;
  onSave: () => void;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** Edição do repertório antes de salvar (seção 16): travar, mover, trocar, remover. */
export function DraftEditor({ draft, setDraft, onAddSong, onRegenerate, onSave, loading, saving, error }: DraftEditorProps) {
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  function move(index: number, direction: -1 | 1) {
    setDraft((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  }

  function toggleLock(tempId: string) {
    setDraft((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, locked: !item.locked } : item)));
  }

  function remove(tempId: string) {
    setRemovingIds((prev) => new Set(prev).add(tempId));
    setTimeout(() => {
      setDraft((prev) => prev.filter((item) => item.tempId !== tempId));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
    }, REMOVE_TRANSITION_MS);
  }

  function updateField(tempId: string, field: "selectedKey" | "notes" | "referenceUrl", value: string) {
    setDraft((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, [field]: value || null } : item)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-base-50">Ajuste seu repertório</h1>
        <Button variant="secondary" onClick={onRegenerate} disabled={loading}>
          {loading ? <Spinner /> : "Gerar outra opção"}
        </Button>
      </div>
      <p className="text-xs text-base-400">Músicas travadas (🔒) não mudam ao gerar outra opção.</p>

      <div className="flex flex-col gap-3">
        {draft.map((item, index) => {
          const isRemoving = removingIds.has(item.tempId);
          return (
            <Card
              key={item.tempId}
              className={cn(
                "animate-fade-in-up flex flex-col gap-3 transition-all duration-200",
                isRemoving && "pointer-events-none -translate-x-1 scale-[0.98] opacity-0"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs text-base-400">
                    {String(index + 1).padStart(2, "0")} — {item.moment}
                  </span>
                  <h3 className="text-base font-semibold text-base-50">{item.song.title}</h3>
                  {item.song.artist && <p className="text-xs text-base-400">{item.song.artist}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-800 text-base-300 transition-colors hover:bg-base-700 active:scale-95 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === draft.length - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-800 text-base-300 transition-colors hover:bg-base-700 active:scale-95 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLock(item.tempId)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors active:scale-95",
                      item.locked ? "bg-accent/20 text-accent" : "bg-base-800 text-base-300 hover:bg-base-700"
                    )}
                    title="Travar música"
                  >
                    🔒
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.tempId)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-800 text-base-300 transition-colors hover:bg-red-500/20 hover:text-red-400 active:scale-95"
                    title="Remover"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Tom (ex.: G)"
                  value={item.selectedKey ?? ""}
                  onChange={(e) => updateField(item.tempId, "selectedKey", e.target.value)}
                />
                <Input
                  placeholder="Link de referência"
                  value={item.referenceUrl ?? ""}
                  onChange={(e) => updateField(item.tempId, "referenceUrl", e.target.value)}
                />
                <Input
                  placeholder="Observação"
                  value={item.notes ?? ""}
                  onChange={(e) => updateField(item.tempId, "notes", e.target.value)}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <p className="mb-2 text-sm font-medium text-base-200">Adicionar outra música</p>
        <AddSongToDraftForm onAdd={onAddSong} />
      </Card>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button onClick={onSave} disabled={saving || draft.length === 0} size="lg">
        {saving ? "Salvando…" : "Salvar repertório"}
      </Button>
    </div>
  );
}
