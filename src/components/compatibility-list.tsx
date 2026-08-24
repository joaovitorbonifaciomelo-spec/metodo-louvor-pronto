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

function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31 31 0 000 12a31 31 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31 31 0 0024 12a31 31 0 00-.5-5.8zM9.6 15.5v-7l6.3 3.5-6.3 3.5z" />
    </svg>
  );
}

interface CompatibilityListProps {
  results: CompatibilityResultItem[];
  primaryActionLabel?: string;
  onPrimaryAction?: (song: Song) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: (song: Song) => void;
}

/**
 * Lista de medleys sugeridos (seções 6, 7 e 13) — sempre 1 coluna,
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
        Nenhum medley forte encontrado ainda. Tente outra música ou adicione mais músicas ao catálogo no admin.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {results.map(({ song, compatibility, reasons }, index) => (
        <Card
          key={song.id}
          className="animate-fade-in-up flex flex-col gap-3"
          style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-base-400">Medley sugerido</span>
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

          {song.youtubeUrl && (
            <a
              href={song.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-1.5 text-xs font-medium text-base-300 hover:text-accent"
            >
              <YoutubeIcon />
              Ouvir referência
            </a>
          )}

          {(primaryActionLabel || secondaryActionLabel) && (
            <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse sm:justify-start">
              {primaryActionLabel && onPrimaryAction && (
                <button
                  type="button"
                  onClick={() => onPrimaryAction(song)}
                  className="min-h-[44px] w-full rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-transform hover:bg-accent/90 active:scale-[0.98] sm:w-auto"
                >
                  {primaryActionLabel}
                </button>
              )}
              {secondaryActionLabel && onSecondaryAction && (
                <button
                  type="button"
                  onClick={() => onSecondaryAction(song)}
                  className="min-h-[44px] w-full rounded-lg border border-base-700 px-4 text-sm font-medium text-base-300 transition-colors hover:bg-base-800 sm:w-auto"
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
