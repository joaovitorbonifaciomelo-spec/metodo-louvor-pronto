import { SongForm } from "@/components/admin/song-form";

export default function NovaMusicaPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-base-50">Nova música</h1>
      <SongForm />
    </div>
  );
}
