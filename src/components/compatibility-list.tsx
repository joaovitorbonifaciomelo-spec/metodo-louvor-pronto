import type { Song } from "@/types/song";
import type { CompatibilityReason } from "@/lib/recommendation/reasons";
import { Badge, Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CompatibilityResultItem {
  song: Song;
  compatibility: number;
  reasons: CompatibilityReason[];
}

function scoreTone(score: number): "accent" | "neutral" | "warning" {
  if (score >= 75) return "accent";
  if (score >= 50) return "neutral";
  return "warning";
}

interface CompatibilityListProps {
  results: CompatibilityResultItem[];
  primaryActionLabel?: string;
  onPrimaryAction?: (song: Song) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: (song: Song) => void;
}

/** Lista de "músicas que combinam" com motivos explicados (seções 6 e 13). */
export function CompatibilityList({
  results,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: CompatibilityListProps) {
  if (results.length === 0) {
    return (
      <Card className="text-center text-sm text-base-400">
        Nenhuma recomendação forte encontrada ainda. Tente outra música ou adicione mais músicas ao catálogo no admin.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {results.map(({ song, compatibility, reasons }, index) => (
        <Card key={song.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs text-base-400">
              <span>#{index + 1}</span>
              {song.key && <Badge>Tom {song.key}</Badge>}
              {song.moments[0] && <Badge>{song.moments[0]}</Badge>}
            </div>
            <h3 className="mt-1 text-base font-semibold text-base-50">{song.title}</h3>
            {song.artist && <p className="text-sm text-base-400">{song.artist}</p>}

            <ul className="mt-3 flex flex-col gap-1">
              {reasons.map((reason, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-1.5 text-xs",
                    reason.kind === "positive" ? "text-base-300" : "text-amber-400"
                  )}
                >
                  <span>{reason.kind === "positive" ? "✓" : "⚠"}</span>
                  <span>{reason.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-3">
            <div className="flex flex-col items-end">
              <Badge tone={scoreTone(compatibility)} className="text-sm">
                {compatibility}% compatível
              </Badge>
            </div>
            <div className="flex gap-2">
              {secondaryActionLabel && onSecondaryAction && (
                <button
                  type="button"
                  onClick={() => onSecondaryAction(song)}
                  className="rounded-lg border border-base-700 px-3 py-1.5 text-xs font-medium text-base-300 hover:bg-base-800"
                >
                  {secondaryActionLabel}
                </button>
              )}
              {primaryActionLabel && onPrimaryAction && (
                <button
                  type="button"
                  onClick={() => onPrimaryAction(song)}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent/90"
                >
                  {primaryActionLabel}
                </button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
