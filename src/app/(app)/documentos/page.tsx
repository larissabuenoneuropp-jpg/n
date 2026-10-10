"use client";
import { PageHeader } from "@/components/ui";
import { DocumentsList } from "@/components/documents-list";

export default function DocumentsPage() {
  return (
    <>
      <PageHeader title="Documentos" subtitle="Arquivos clínicos vinculados aos pacientes" />
      <DocumentsList />
    </>
  );
}
