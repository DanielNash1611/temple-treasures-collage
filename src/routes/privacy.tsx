import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({
    meta: [
      { title: "Privacy & Trust · Temple Trip Scavenger Hunt" },
      {
        name: "description",
        content:
          "How the Temple Trip Scavenger Hunt collects, stores, and protects photos and family information.",
      },
    ],
  }),
});

function Privacy() {
  return (
    <div className="min-h-screen px-5 py-12">
      <div className="mx-auto max-w-2xl space-y-6 text-foreground">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70">Trust &amp; Privacy</p>
          <h1 className="mt-1 text-3xl font-semibold text-primary">How we handle your photos</h1>
        </header>

        <section className="temple-card p-6 space-y-3 text-sm leading-relaxed">
          <h2 className="font-serif text-lg text-primary">What we collect</h2>
          <p>
            For each scavenger hunt prompt, your family may upload a photo and an optional short
            caption. We also store the family name and a short access code provided by your group
            leader.
          </p>
        </section>

        <section className="temple-card p-6 space-y-3 text-sm leading-relaxed">
          <h2 className="font-serif text-lg text-primary">Who can see what</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Family access codes are private. They are only used to verify your family before
              uploading or editing a submission and are never exposed to other visitors.</li>
            <li>Only people with your family's access code can add, edit, or delete that family's
              submissions.</li>
            <li>Photos approved for the combined keepsake may be visible to other participating
              families inside the app.</li>
            <li>Group leaders (administrators) can review, approve, or remove any submission.</li>
          </ul>
        </section>

        <section className="temple-card p-6 space-y-3 text-sm leading-relaxed">
          <h2 className="font-serif text-lg text-primary">How we protect it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>All traffic is served over HTTPS.</li>
            <li>Writes (upload, edit, delete) require proving knowledge of the family access code on
              the server.</li>
            <li>Photo files live in a managed storage bucket; direct listing of the bucket is
              disabled.</li>
          </ul>
        </section>

        <section className="temple-card p-6 space-y-3 text-sm leading-relaxed">
          <h2 className="font-serif text-lg text-primary">Removing your photos</h2>
          <p>
            You can delete any photo from your family page. Group leaders can also remove
            submissions on request.
          </p>
        </section>

        <p className="text-xs text-muted-foreground">
          This page describes the controls built into this app. It is not a legal certification or
          independent audit.
        </p>

        <p className="text-sm">
          <Link to="/" className="text-primary underline">Back home</Link>
        </p>
      </div>
    </div>
  );
}
