"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MOMENTS, THEMES, type Song } from "@/types/song";

interface SongFormProps {
  song?: Song;
}

function toCommaList(values: string[]): string {
  return values.join(", ");
}

function fromCommaList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Sugestão automática do enriquecimento via YouTube (seção 10) — aprovar/rejeitar/trocar. */
function YoutubeSuggestionReview({ song, onApprove }: { song: Song; onApprove: (url: string) => void }) {
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const suggestedUrl = `https://www.youtube.com/watch?v=${song.youtubeVideoId}`;

  async function patch(body: Record<string, unknown>) {
    setStatus("saving");
    await fetch(`/api/songs/${song.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setStatus("idle");
  }

  return (
    <Card className="flex flex-col gap-3 border-accent/30 bg-accent/5">
      <p className="text-sm font-medium text-base-200">Sugestão automática do YouTube — precisa de revisão</p>
      <div className="flex items-start gap-3">
        {song.youtubeThumbnail && (
          <Image
            src={song.youtubeThumbnail}
            alt=""
            width={112}
            height={64}
            className="h-16 w-28 shrink-0 rounded-lg object-cover"
            unoptimized
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm text-base-100">{song.youtubeTitle}</p>
          <p className="truncate text-xs text-base-400">{song.youtubeChannel}</p>
          <a href={suggestedUrl} target="_blank" rel="noreferrer" className="text-xs text-accent underline">
            Abrir no YouTube
          </a>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={status === "saving"}
          onClick={async () => {
            await patch({ youtubeUrl: suggestedUrl, reviewRequired: false, youtubeStatus: "confirmed" });
            onApprove(suggestedUrl);
          }}
        >
          Aprovar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={status === "saving"}
          onClick={() => patch({ youtubeStatus: "not_found" })}
        >
          Rejeitar
        </Button>
      </div>
    </Card>
  );
}

export function SongForm({ song }: SongFormProps) {
  const router = useRouter();
  const isEdit = Boolean(song);

  const [title, setTitle] = useState(song?.title ?? "");
  const [artist, setArtist] = useState(song?.artist ?? "");
  const [version, setVersion] = useState(song?.version ?? "");
  const [key, setKey] = useState(song?.key ?? "");
  const [capo, setCapo] = useState(song?.capo?.toString() ?? "");
  const [difficulty, setDifficulty] = useState(song?.difficulty ?? "");
  const [energy, setEnergy] = useState(song?.energy?.toString() ?? "");
  const [bpm, setBpm] = useState(song?.bpm?.toString() ?? "");
  const [moments, setMoments] = useState<string[]>(song?.moments ?? []);
  const [themes, setThemes] = useState(toCommaList(song?.themes ?? []));
  const [tags, setTags] = useState(toCommaList(song?.tags ?? []));
  const [youtubeUrl, setYoutubeUrl] = useState(song?.youtubeUrl ?? "");
  const [active, setActive] = useState(song?.active ?? true);
  const [reviewRequired, setReviewRequired] = useState(song?.reviewRequired ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMoment(moment: string) {
    setMoments((prev) => (prev.includes(moment) ? prev.filter((m) => m !== moment) : [...prev, moment]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body = {
      title,
      artist: artist || null,
      version: version || null,
      key: key || null,
      capo: capo ? Number(capo) : null,
      difficulty: difficulty || null,
      energy: energy ? Number(energy) : null,
      bpm: bpm ? Number(bpm) : null,
      moments,
      themes: fromCommaList(themes),
      tags: fromCommaList(tags),
      youtubeUrl: youtubeUrl || null,
      active,
      reviewRequired,
    };

    const res = await fetch(isEdit ? `/api/songs/${song!.id}` : "/api/songs", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Falha ao salvar.");
      return;
    }

    router.push("/admin/musicas");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="title">Título *</Label>
          <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="artist">Artista/versão</Label>
          <Input id="artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="version">Versão (opcional)</Label>
          <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="key">Tom</Label>
          <Input id="key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Ex.: G, Am" />
        </div>
        <div>
          <Label htmlFor="capo">Capotraste</Label>
          <Input id="capo" type="number" min={0} max={12} value={capo} onChange={(e) => setCapo(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="bpm">BPM</Label>
          <Input id="bpm" type="number" min={40} max={300} value={bpm} onChange={(e) => setBpm(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="difficulty">Dificuldade</Label>
          <Select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">—</option>
            <option value="iniciante">iniciante</option>
            <option value="intermediaria">intermediária</option>
            <option value="avancada">avançada</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="energy">Energia (1-5)</Label>
          <Select id="energy" value={energy} onChange={(e) => setEnergy(e.target.value)}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Momentos do culto</Label>
        <div className="flex flex-wrap gap-2">
          {MOMENTS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMoment(m)}
              className={`rounded-full px-3 py-1 text-xs ${
                moments.includes(m) ? "bg-accent text-accent-fg" : "bg-base-800 text-base-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="themes">Temas (separados por vírgula)</Label>
        <Input id="themes" value={themes} onChange={(e) => setThemes(e.target.value)} placeholder={THEMES.slice(0, 4).join(", ")} />
      </div>

      <div>
        <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
        <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="youtubeUrl">Link do YouTube</Label>
        <Input id="youtubeUrl" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/…" />
      </div>

      {song?.youtubeStatus === "review" && song.youtubeVideoId && (
        <YoutubeSuggestionReview song={song} onApprove={(url) => setYoutubeUrl(url)} />
      )}

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-base-300">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativa (visível na busca)
        </label>
        <label className="flex items-center gap-2 text-sm text-base-300">
          <input type="checkbox" checked={reviewRequired} onChange={(e) => setReviewRequired(e.target.checked)} />
          Precisa de revisão (ex.: artista incerto — desmarque depois de confirmar)
        </label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card className="flex justify-end gap-2 bg-transparent p-0">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar música"}
        </Button>
      </Card>
    </form>
  );
}
