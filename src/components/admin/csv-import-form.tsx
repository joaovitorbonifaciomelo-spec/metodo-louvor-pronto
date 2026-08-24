"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";

interface ImportResult {
  imported: number;
  duplicated: { title: string; matchedExisting: string }[];
  reviewRecommended: { title: string; matchedExisting: string; similarity: number }[];
  invalid: { rowNumber: number; errors: string[] }[];
  totalRows: number;
}

const TEMPLATE = `title,artist,version,key,capo,difficulty,energy,bpm,moments,themes,tags,youtube_url
Bondade de Deus,Isaías Saad,,G,0,intermediaria,3,80,Adoração|Ministração,fidelidade|gratidão,contemporaneo,`;

export function CsvImportForm() {
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/songs/import", { method: "POST", body: csvText });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao importar.");
        return;
      }
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="mb-2 text-sm text-base-300">
          Formato: colunas separadas por vírgula; campos com múltiplos valores (moments/themes/tags) usam{" "}
          <code className="rounded bg-base-800 px-1">|</code> como separador interno.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-base-950 p-3 text-xs text-base-400">{TEMPLATE}</pre>
      </Card>

      <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm text-base-300" />
      <Textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder="Cole o CSV aqui…"
        rows={10}
        className="font-mono text-xs"
      />

      <Button onClick={handleImport} disabled={loading || !csvText.trim()}>
        {loading ? "Importando…" : "Importar"}
      </Button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-base-200">
            {result.imported} importadas · {result.duplicated.length} duplicadas · {result.reviewRecommended.length} para revisão ·{" "}
            {result.invalid.length} inválidas (de {result.totalRows} linhas)
          </p>

          {result.duplicated.length > 0 && (
            <div>
              <p className="text-xs font-medium text-base-300">Duplicadas (não importadas):</p>
              <ul className="text-xs text-base-400">
                {result.duplicated.map((d, i) => (
                  <li key={i}>
                    &ldquo;{d.title}&rdquo; já existe como &ldquo;{d.matchedExisting}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.reviewRecommended.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-400">Importadas, mas parecidas com uma existente — revisar:</p>
              <ul className="text-xs text-base-400">
                {result.reviewRecommended.map((d, i) => (
                  <li key={i}>
                    &ldquo;{d.title}&rdquo; ~ &ldquo;{d.matchedExisting}&rdquo; ({Math.round(d.similarity * 100)}%)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.invalid.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-400">Linhas inválidas:</p>
              <ul className="text-xs text-base-400">
                {result.invalid.map((d, i) => (
                  <li key={i}>
                    Linha {d.rowNumber}: {d.errors.join("; ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
