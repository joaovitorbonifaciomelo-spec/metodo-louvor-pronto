import { CsvImportForm } from "@/components/admin/csv-import-form";

export default function ImportarPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-base-50">Importar músicas (CSV)</h1>
      <CsvImportForm />
    </div>
  );
}
