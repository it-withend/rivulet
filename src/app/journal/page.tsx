import { FieldJournal } from "@/components/journal/FieldJournal";

export default function JournalPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 sm:px-6">
      <header>
        <p className="field-label m-0">My journal</p>
        <h1 className="mt-2 mb-0 text-4xl">What you have done for your streams</h1>
      </header>
      <FieldJournal />
    </div>
  );
}
