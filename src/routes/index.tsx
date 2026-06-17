import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import moroniLogo from "@/assets/moroni.png";

export const Route = createFileRoute("/")({ component: Welcome });

function Welcome() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("get_family_by_code", { _code: trimmed });
    setLoading(false);
    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      toast.error("That code doesn't match a family. Double-check with your group leader.");
      return;
    }
    navigate({ to: "/family/$code", params: { code: trimmed } });
  };

  return (
    <div className="min-h-screen px-5 py-10">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <img
            src={moroniLogo}
            alt="Angel Moroni"
            className="mx-auto h-20 w-auto drop-shadow-[0_4px_12px_rgba(184,151,95,0.35)]"
          />
          <p className="mt-3 text-sm uppercase tracking-[0.2em] text-primary/80">Primary</p>
          <h1 className="mt-2 text-4xl font-semibold text-primary">Temple Trip Scavenger Hunt</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Work together as a family to notice sacred, peaceful, and beautiful things around the
            temple and visitors' center.
          </p>
        </div>

        <form onSubmit={submit} className="temple-card mt-8 p-6">
          <label className="block text-sm font-medium text-foreground">
            Family access code
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="e.g. SMITH-42"
            className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-lg tracking-wider focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading ? "Checking…" : "Start the hunt"}
          </button>
        </form>

        <div className="temple-card mt-6 p-6">
          <h2 className="text-lg font-semibold text-primary">A few simple rules</h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            <li>• Stay with your family.</li>
            <li>• Be reverent and respectful.</li>
            <li>• Take photos only in approved areas.</li>
            <li>• Adults should help upload photos.</li>
            <li>• One good photo per prompt is enough.</li>
            <li>• Return to the group when finished.</li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Photos are for this private Primary temple trip keepsake and will not be posted publicly
            by this app.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/admin" className="underline">Admin sign in</Link>
        </p>
      </div>
    </div>
  );
}
