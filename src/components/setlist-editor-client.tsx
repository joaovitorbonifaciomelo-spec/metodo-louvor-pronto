"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, Spinner } from "@/components/ui/card";
import { SongAutocomplete } from "@/components/song-autocomplete";
import { useToast } from "@/components/ui/toast-provider";
import { MOMENTS } from "@/types/song";
import { cn } from "@/lib/utils";
import type { Song } from "@/types/song";
import type { Setlist, SetlistItemWithSong } from "@/types/setlist";
import { buildShareText } from "@/lib/setlists/shareText";
import { track } from "@/lib/analytics/track";

const REMOVE_TRANSITION_MS = 180;

interface SetlistEditorClientProps {
  setlistId: string;
  setlist: Setlist;
  initialItems: SetlistItemWithSong[];
  initialShareSlug: string | null;
}

async function api<T>(url: string, options?: RequestInit): Promise<{ ok: boolean; data: T | { error: string } }> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export function SetlistEditorClient({ setlistId, setlist, initialItems, initialShareSlug }: SetlistEditorClientProps) {
  const showToast = useToast();
  const [items, setItems] = useState<SetlistItemWithSong[]>(initialItems);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [flashId, setFlashId] = useState<string | null>(null);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(initialShareSlug ? `/s/${initialShareSlug}` : null);
  const [copied, setCopied] = useState(false);
  const [addingMoment, setAddingMoment] = useState<string>(MOMENTS[0]);
  const [error, setError] = useState<string | null>(null);

  function flash(id: string) {
    setFlashId(id);
    setTimeout(() => setFlashId((current) => (current === id ? null : current)), 400);
  }

  /** Optimistic update com rollback silencioso + toast se a persistência falhar. */
  async function persist(action: () => Promise<{ ok: boolean }>, rollback: () => void, failureMessage: string) {
    const { ok } = await action();
    if (!ok) {
      rollback();
      showToast(failureMessage, "error");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    setItems(next);

    await persist(
      () =>
        api(`/api/setlists/${setlistId}/items`, {
          method: "PATCH",
          body: JSON.stringify({ items: next.map((item, i) => ({ id: item.id, position: i + 1 })) }),
        }),
      () => setItems(previous),
      "Não deu para salvar a nova ordem. Restauramos a anterior."
    );
  }

  async function toggleLock(item: SetlistItemWithSong) {
    const previous = items;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, locked: !i.locked } : i)));
    await persist(
      () => api(`/api/setlists/${setlistId}/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ locked: !item.locked }) }),
      () => setItems(previous),
      "Não deu para travar/destravar essa música."
    );
  }

  function remove(item: SetlistItemWithSong) {
    const previous = items;
    setRemovingIds((prev) => new Set(prev).add(item.id));
    setTimeout(async () => {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      await persist(
        () => api(`/api/setlists/${setlistId}/items/${item.id}`, { method: "DELETE" }),
        () => setItems(previous),
        "Não deu para remover essa música."
      );
    }, REMOVE_TRANSITION_MS);
  }

  async function updateField(item: SetlistItemWithSong, field: "selectedKey" | "notes" | "referenceUrl", value: string) {
    const previous = items;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, [field]: value || null } : i)));
    await persist(
      () => api(`/api/setlists/${setlistId}/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ [field]: value || null }) }),
      () => setItems(previous),
      "Não deu para salvar essa alteração."
    );
  }

  async function swapSong(item: SetlistItemWithSong, song: Song) {
    const previous = items;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, song, songId: song.id } : i)));
    setSwappingId(null);
    flash(item.id);
    await persist(
      () => api(`/api/setlists/${setlistId}/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ songId: song.id }) }),
      () => setItems(previous),
      "Não deu para trocar essa música."
    );
  }

  async function addSong(song: Song) {
    const { ok, data } = await api<{ item: { id: string } }>(`/api/setlists/${setlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ songId: song.id, moment: addingMoment }),
    });
    if (ok && "item" in data) {
      setItems((prev) => [
        ...prev,
        {
          id: data.item.id,
          setlistId,
          songId: song.id,
          position: prev.length + 1,
          moment: addingMoment,
          selectedKey: song.key,
          notes: null,
          referenceUrl: song.youtubeUrl,
          locked: false,
          song,
        },
      ]);
      track("song_added", { setlistId, songId: song.id });
    } else {
      showToast("Não deu para adicionar essa música.", "error");
    }
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    const { ok, data } = await api<{ items: SetlistItemWithSong[] }>(`/api/setlists/${setlistId}/regenerate`, {
      method: "POST",
    });
    setBusy(false);
    if (ok && "items" in data) {
      setItems(data.items);
      showToast("Nova opção gerada.");
    } else if (!ok && "error" in data) {
      setError(data.error);
    }
  }

  async function share() {
    const { ok, data } = await api<{ shareUrl: string }>(`/api/setlists/${setlistId}/share`, { method: "POST" });
    if (ok && "shareUrl" in data) {
      setShareUrl(data.shareUrl);
    } else {
      showToast("Não deu para gerar o link de compartilhamento.", "error");
    }
  }

  async function copyToWhatsApp() {
    const text = buildShareText(setlist.name, items);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    showToast("Copiado para a área de transferência.");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-base-50">{setlist.name}</h1>
          <p className="text-xs text-base-400">
            {setlist.serviceType}
            {setlist.theme ? ` · ${setlist.theme}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={regenerate} disabled={busy}>
            {busy ? <Spinner /> : "Gerar outra opção"}
          </Button>
          <Button variant="secondary" onClick={share}>
            Compartilhar
          </Button>
        </div>
      </div>

      {shareUrl && (
        <Card className="animate-fade-in-up flex flex-wrap items-center justify-between gap-3 border-accent/30 bg-accent/5">
          <div className="text-sm text-base-200">
            Link público:{" "}
            <a href={shareUrl} target="_blank" rel="noreferrer" className="text-accent underline">
              {shareUrl}
            </a>
          </div>
          <Button size="sm" onClick={copyToWhatsApp}>
            {copied ? "Copiado!" : "Copiar para WhatsApp"}
          </Button>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-col gap-3">
        {items.map((item, index) => {
          const isRemoving = removingIds.has(item.id);
          return (
            <Card
              key={item.id}
              className={cn(
                "animate-fade-in-up flex flex-col gap-3 transition-all duration-200",
                isRemoving && "pointer-events-none -translate-x-1 scale-[0.98] opacity-0",
                flashId === item.id && "ring-2 ring-accent/50"
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
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <button
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-800 text-base-300 transition-colors hover:bg-base-700 active:scale-95 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-800 text-base-300 transition-colors hover:bg-base-700 active:scale-95 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => toggleLock(item)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors active:scale-95",
                      item.locked ? "bg-accent/20 text-accent" : "bg-base-800 text-base-300 hover:bg-base-700"
                    )}
                  >
                    🔒
                  </button>
                  <button
                    onClick={() => setSwappingId(swappingId === item.id ? null : item.id)}
                    className="flex h-9 items-center rounded-lg bg-base-800 px-3 text-xs font-medium text-base-300 transition-colors hover:bg-base-700 active:scale-95"
                  >
                    Trocar
                  </button>
                  <button
                    onClick={() => remove(item)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-base-800 text-base-300 transition-colors hover:bg-red-500/20 hover:text-red-400 active:scale-95"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {swappingId === item.id && (
                <div className="animate-fade-in-up">
                  <SongAutocomplete onSelect={(song) => swapSong(item, song)} placeholder="Buscar música para substituir…" />
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Tom"
                  defaultValue={item.selectedKey ?? ""}
                  onBlur={(e) => updateField(item, "selectedKey", e.target.value)}
                />
                <Input
                  placeholder="Link de referência"
                  defaultValue={item.referenceUrl ?? ""}
                  onBlur={(e) => updateField(item, "referenceUrl", e.target.value)}
                />
                <Input
                  placeholder="Observação"
                  defaultValue={item.notes ?? ""}
                  onBlur={(e) => updateField(item, "notes", e.target.value)}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <p className="mb-2 text-sm font-medium text-base-200">Adicionar música</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={addingMoment} onChange={(e) => setAddingMoment(e.target.value)} className="sm:w-48">
            {MOMENTS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <div className="flex-1">
            <SongAutocomplete onSelect={addSong} placeholder="Adicionar música…" />
          </div>
        </div>
      </Card>
    </div>
  );
}
