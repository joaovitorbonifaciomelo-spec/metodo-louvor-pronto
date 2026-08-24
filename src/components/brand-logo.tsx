import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "full" | "mark";
  className?: string;
  priority?: boolean;
}

/**
 * Logo real do Método Louvor Pronto (assets/brand-source → public/brand,
 * gerados por scripts/process-brand-assets.js). "full" é o wordmark
 * completo (header desktop/hero); "mark" é o símbolo compacto (header
 * mobile, favicon, estados vazios/loading).
 */
export function BrandLogo({ variant = "full", className, priority }: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/logo-mark-512.png"
        alt="Método Louvor Pronto"
        width={512}
        height={512}
        priority={priority}
        className={cn("h-9 w-9 object-contain", className)}
      />
    );
  }

  return (
    <Image
      src="/brand/logo-full.png"
      alt="Método Louvor Pronto"
      width={900}
      height={720}
      priority={priority}
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}
