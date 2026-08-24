"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Card, Spinner } from "@/components/ui/card";
import { track } from "@/lib/analytics/track";
import { MOMENTS } from "@/types/song";
import type { Song } from "@/types/song";
import { SERVICE_TYPES, TEAM_LEVELS, type ServiceType, type TeamLevel } from "@/types/setlist";
import { DEFAULT_STRUCTURE_BY_SERVICE_TYPE } from "@/lib/setlists/structureTemplates";
import type { SetlistStructureSlot, GeneratedSetlist } from "@/lib/recommendation/generateSetlist";
import type { DraftSetlistItem } from "@/types/draft";
import { DraftEditor } from "@/components/draft-editor";

let tempIdCounter = 0;
function nextTempId() {
  tempIdCounter += 1;
  return `draft-${tempIdCounter}`;
}

export function NovoCultoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mandatorySongId = searchParams.get("mandatorySongId");
  const mandatorySongTitle = searchParams.get("mandatorySongTitle");

  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("Domingo");
  const [serviceDate, setServiceDate] = useState("");
  const [theme, setTheme] = useState("");
  const [teamLevel, setTeamLevel] = useState<TeamLevel>("intermediaria");
  const [structure, setStructure] = useState<SetlistStructureSlot[]>(DEFAULT_STRUCTURE_BY_SERVICE_TYPE.Domingo);

  const [phase, setPhase] = useState<"form" | "variants" | "editing">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variants, setVariants] = useState<GeneratedSetlist[]>([]);
  const [draft, setDraft] = useState<DraftSetlistItem[]>([]);
  const [saving, setSaving] = useState(false);

  const totalSongs = useMemo(() => structure.reduce((sum, s) => sum + s.count, 0), [structure]);

  function updateServiceType(value: ServiceType) {
    setServiceType(value);
    setStructure(DEFAULT_STRUCTURE_BY_SERVICE_TYPE[value]);
  }

  function updateMomentCount(moment: string, count: number) {
    setStructure((prev) => {
      const existing = prev.find((s) => s.moment === moment);
      if (count <= 0) return prev.filter((s) => s.moment !== moment);
      if (existing) return prev.map((s) => (s.moment === moment ? { ...s, count } : s));
      return [...prev, { moment, count }];
    });
  }

  async function handleGenerate() {
    setError(null);
    if (totalSongs < 1 || totalSongs > 10) {
      setError("O repertório precisa ter entre 1 e 10 músicas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/setlists/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamLevel,
          structure,
          theme: theme || null,
          mandatorySongId: mandatorySongId || null,
          variantCount: 2,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível gerar o repertório.");
        return;
      }
      setVariants(data.variants ?? []);
      setPhase("variants");
    } finally {
      setLoading(false);
    }
  }

  function chooseVariant(variant: GeneratedSetlist) {
    setDraft(
      variant.items.map((item) => ({
        tempId: nextTempId(),
        song: item.song,
        moment: item.moment,
        selectedKey: item.song.key,
        notes: null,
        referenceUrl: item.song.youtubeUrl,
        locked: item.locked,
      }))
    );
    setPhase("editing");
  }

  async function regenerateDraft() {
    setLoading(true);
    setError(null);
    try {
      const draftStructure = draft.map((item) => ({ moment: item.moment, count: 1 }));
      const lockedItems = draft
        .map((item, index) => ({ position: index + 1, songId: item.song.id, locked: item.locked }))
        .filter((i) => i.locked)
        .map(({ position, songId }) => ({ position, songId }));

      const res = await fetch("/api/setlists/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamLevel,
          structure: draftStructure,
          theme: theme || null,
          variantCount: 1,
          lockedItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível gerar outra opção.");
        return;
      }
      const [variant] = data.variants ?? [];
      if (variant) chooseVariant(variant);
    } finally {
      setLoading(false);
    }
  }

  function addSongToDraft(song: Song, moment: string) {
    setDraft((prev) => [
      ...prev,
      { tempId: nextTempId(), song, moment, selectedKey: song.key, notes: null, referenceUrl: song.youtubeUrl, locked: false },
    ]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/setlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || `${serviceType} — ${serviceDate || "sem data"}`,
          serviceType,
          theme: theme || null,
          serviceDate: serviceDate || null,
          teamLevel,
          items: draft.map((item, index) => ({
            songId: item.song.id,
            position: index + 1,
            moment: item.moment,
            selectedKey: item.selectedKey,
            notes: item.notes,
            referenceUrl: item.referenceUrl,
            locked: item.locked,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o culto.");
        return;
      }
      track("setlist_created", { setlistId: data.setlist.id });
      router.push(`/cultos/${data.setlist.id}`);
    } finally {
      setSaving(false);
    }
  }

  if (phase === "editing") {
    return (
      <DraftEditor
        draft={draft}
        setDraft={setDraft}
        onAddSong={addSongToDraft}
        onRegenerate={regenerateDraft}
        onSave={handleSave}
        loading={loading}
        saving={saving}
        error={error}
      />
    );
  }

  if (phase === "variants") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-base-50">Escolha um repertório</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {variants.map((variant) => (
            <Card key={variant.label} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-base-200">Repertório {variant.label}</h2>
              <ol className="flex flex-col gap-2">
                {variant.items.map((item, index) => (
                  <li key={index} className="text-sm">
                    <span className="text-base-500">{String(index + 1).padStart(2, "0")} — </span>
                    <span className="font-medium text-base-100">{item.song.title}</span>
                    <span className="ml-2 text-xs text-base-400">
                      {item.moment}
                      {item.song.key ? ` · Tom ${item.song.key}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
              <Button onClick={() => chooseVariant(variant)}>Usar este repertório</Button>
            </Card>
          ))}
        </div>
        <button type="button" className="text-sm text-base-400 hover:underline" onClick={() => setPhase("form")}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-base-50">Novo Culto</h1>
        <p className="mt-1 text-sm text-base-400">Defina a estrutura e deixe o algoritmo montar o repertório.</p>
      </div>

      {mandatorySongId && mandatorySongTitle && (
        <Card className="text-sm text-base-200">
          Música obrigatória: <span className="font-medium text-accent">{mandatorySongTitle}</span>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Nome do culto</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Culto de Domingo" />
        </div>
        <div>
          <Label htmlFor="serviceType">Tipo do culto</Label>
          <Select
            id="serviceType"
            value={serviceType}
            onChange={(e) => updateServiceType(e.target.value as ServiceType)}
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="serviceDate">Data</Label>
          <Input id="serviceDate" type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="teamLevel">Nível da equipe</Label>
          <Select id="teamLevel" value={teamLevel} onChange={(e) => setTeamLevel(e.target.value as TeamLevel)}>
            {TEAM_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="theme">Tema (opcional)</Label>
          <Textarea id="theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Ex.: gratidão, fidelidade…" rows={2} />
        </div>
      </div>

      <div>
        <Label>Estrutura do culto</Label>
        <div className="flex flex-col gap-2">
          {MOMENTS.map((moment) => {
            const count = structure.find((s) => s.moment === moment)?.count ?? 0;
            return (
              <div key={moment} className="flex items-center justify-between rounded-xl border border-base-800 px-3 py-2">
                <span className="text-sm text-base-200">{moment}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-7 w-7 rounded-lg bg-base-800 text-base-200 hover:bg-base-700"
                    onClick={() => updateMomentCount(moment, Math.max(0, count - 1))}
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm text-base-100">{count}</span>
                  <button
                    type="button"
                    className="h-7 w-7 rounded-lg bg-base-800 text-base-200 hover:bg-base-700"
                    onClick={() => updateMomentCount(moment, count + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className={`mt-2 text-xs ${totalSongs > 10 || totalSongs < 1 ? "text-red-400" : "text-base-400"}`}>
          Total: {totalSongs} música{totalSongs === 1 ? "" : "s"} (1 a 10)
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button onClick={handleGenerate} disabled={loading} size="lg">
        {loading ? (
          <>
            <Spinner /> Montando repertório…
          </>
        ) : (
          "Montar repertório"
        )}
      </Button>
    </div>
  );
}

