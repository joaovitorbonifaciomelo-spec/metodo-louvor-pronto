import { Suspense } from "react";
import { NovoCultoClient } from "@/components/novo-culto-client";

export default function NovoCultoPage() {
  return (
    <Suspense fallback={null}>
      <NovoCultoClient />
    </Suspense>
  );
}
