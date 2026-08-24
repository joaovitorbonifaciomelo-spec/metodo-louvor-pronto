"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/card";

export function ToggleActiveButton({ songId, active }: { songId: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await fetch(`/api/songs/${songId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button type="button" onClick={toggle} disabled={loading}>
      <Badge tone={active ? "accent" : "neutral"}>{loading ? "…" : active ? "Ativa" : "Inativa"}</Badge>
    </button>
  );
}
