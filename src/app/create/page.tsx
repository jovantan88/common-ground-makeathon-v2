import type { Metadata } from "next";
import { SagaCreator } from "@/components/saga-creator";

export const metadata: Metadata = { title: "New saga — Surname Saga" };

export default async function CreatePage(props: PageProps<"/create">) {
  const sp = await props.searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 40) ?? "";
  const surname = first(sp.surname);
  const name = first(sp.name);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      {/* Keyed so a new surname from the header starts a fresh flow. */}
      <SagaCreator key={`${surname}|${name}`} initialSurname={surname} initialName={name} />
    </div>
  );
}
