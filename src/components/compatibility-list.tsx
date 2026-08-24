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

/**
 * Lista de "músicas que combinam" (seções 6 e 13) — sempre 1 coluna,
 * sem comprimir informação horizontalmente (seção "Recomendações" do
 * briefing de UX mobile): score → título/artista → motivos → tom/momento → ação.
 */
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
      {results.map(({ song, compatibility, reasons }) => (
        <Card key={song.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Badge tone={scoreTone(compatibility)} className="text-sm">
              {compatibility}% compatível
            </Badge>
          </div>

          <div>
            <h3 className="text-base font-semibold leading-snug text-base-50">{song.title}</h3>
            {song.artist && <p className="text-sm text-base-400">{song.artist}</p>}
          </div>

          {reasons.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {reasons.map((reason, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-1.5 text-[13px] leading-snug",
                    reason.kind === "positive" ? "text-base-300" : "text-amber-400"
                  )}
                >
                  <span className="shrink-0">{reason.kind === "positive" ? "✓" : "⚠"}</span>
                  <span>{reason.text}</span>
                </li>
              ))}
            </ul>
          )}

          {(song.key || song.moments[0]) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-400">
              {song.key && <span>Tom {song.key}</span>}
              {song.key && song.moments[0] && <span aria-hidden>•</span>}
              {song.moments[0] && <span>{song.moments[0]}</span>}
            </div>
          )}

          {(primaryActionLabel || secondaryActionLabel) && (
            <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse sm:justify-start">
              {primaryActionLabel && onPrimaryAction && (
                <button
                  type="button"
                  onClick={() => onPrimaryAction(song)}
                  className="min-h-[44px] w-full rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent/90 sm:w-auto"
                >
                  {primaryActionLabel}
                </button>
              )}
              {secondaryActionLabel && onSecondaryAction && (
                <button
                  type="button"
                  onClick={() => onSecondaryAction(song)}
                  className="min-h-[44px] w-full rounded-lg border border-base-700 px-4 text-sm font-medium text-base-300 hover:bg-base-800 sm:w-auto"
                >
                  {secondaryActionLabel}
                </button>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
