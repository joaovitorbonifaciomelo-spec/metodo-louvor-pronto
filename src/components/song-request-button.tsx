"use client";

import { useState } from "react";

/** "Solicitar música" quando a busca não encontra nada (seção 20). */
export function SongRequestButton({ query }: { query: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleRequest() {
    setStatus("sending");
    try {
      const res = await fetch("/api/song-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <p className="mt-2 text-xs text-accent">Pedido enviado! Vamos avaliar para o catálogo.</p>;
  }

  return (
    <button
      type="button"
      onClick={handleRequest}
      disabled={status === "sending"}
      className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-60"
    >
      {status === "sending" ? "Enviando…" : "Solicitar música"}
    </button>
  );
}
