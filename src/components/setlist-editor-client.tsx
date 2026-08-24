"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, Spinner } from "@/components/ui/card";
import { SongAutocomplete } from "@/components/song-autocomplete";
import { MOMENTS } from "@/types/song";
import type { Song } from "@/types/song";
import type { Setlist, SetlistItemWithSong } from "@/types/setlist";
import { buildShareText } from "@/lib/setlists/shareText";
import { track } from "@/lib/analytics/track";

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
  const [items, setItems] = useState<SetlistItemWithSong[]>(initialItems);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(initialShareSlug ? `/s/${initialShareSlug}` : null);
  const [copied, setCopied] = useState(false);
  const [addingMoment, setAddingMoment] = useState<string>(MOMENTS[0]);
  const [error, setError] = useState<string | null>(null);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    setItems(next);

    await api(`/api/setlists/${setlistId}/items`, {
      method: "PATCH",
      body: JSON.stringify({ items: next.map((item, i) => ({ id: item.id, position: i + 1 })) }),
    });
  }

  async function toggleLock(item: SetlistItemWithSong) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, locked: !i.locked } : i)));
    await api(`/api/setlists/${setlistId}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ locked: !item.locked }),
    });
  }

  async function remove(item: SetlistItemWithSong) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await api(`/api/setlists/${setlistId}/items/${item.id}`, { method: "DELETE" });
  }

  async function updateField(item: SetlistItemWithSong, field: "selectedKey" | "notes" | "referenceUrl", value: string) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, [field]: value || null } : i)));
    await api(`/api/setlists/${setlistId}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ [field]: value || null }),
    });
  }

  async function swapSong(item: SetlistItemWithSong, song: Song) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, song, songId: song.id } : i)));
    setSwappingId(null);
    await api(`/api/setlists/${setlistId}/items/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ songId: song.id }),
    });
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
    } else if (!ok && "error" in data) {
      setError(data.error);
    }
  }

  async function share() {
    const { ok, data } = await api<{ shareUrl: string }>(`/api/setlists/${setlistId}/share`, { method: "POST" });
    if (ok && "shareUrl" in data) setShareUrl(data.shareUrl);
  }

  async function copyToWhatsApp() {
    const text = buildShareText(setlist.name, items);
    await navigator.clipboard.writeText(text);
    setCopied(true);
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
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/30 bg-accent/5">
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
        {items.map((item, index) => (
          <Card key={item.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs text-base-500">
                  {String(index + 1).padStart(2, "0")} — {item.moment}
                </span>
                <h3 className="text-base font-semibold text-base-50">{item.song.title}</h3>
                {item.song.artist && <p className="text-xs text-base-400">{item.song.artist}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => move(index, -1)} disabled={index === 0} className="h-7 w-7 rounded-lg bg-base-800 text-base-300 hover:bg-base-700 disabled:opacity-30">
                  ↑
                </button>
                <button onClick={() => move(index, 1)} disabled={index === items.length - 1} className="h-7 w-7 rounded-lg bg-base-800 text-base-300 hover:bg-base-700 disabled:opacity-30">
                  ↓
                </button>
                <button
                  onClick={() => toggleLock(item)}
                  className={`h-7 w-7 rounded-lg text-sm hover:bg-base-700 ${item.locked ? "bg-accent/20 text-accent" : "bg-base-800 text-base-300"}`}
                >
                  🔒
                </button>
                <button onClick={() => setSwappingId(swappingId === item.id ? null : item.id)} className="h-7 rounded-lg bg-base-800 px-2 text-xs text-base-300 hover:bg-base-700">
                  Trocar
                </button>
                <button onClick={() => remove(item)} className="h-7 w-7 rounded-lg bg-base-800 text-base-300 hover:bg-red-500/20 hover:text-red-400">
                  ✕
                </button>
              </div>
            </div>

            {swappingId === item.id && (
              <SongAutocomplete onSelect={(song) => swapSong(item, song)} placeholder="Buscar música para substituir…" />
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
        ))}
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
