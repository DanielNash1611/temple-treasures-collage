import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Family, Submission } from "@/lib/types";

export const Route = createFileRoute("/admin/")({ component: AdminHome });

function AdminHome() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [promptsCount, setPromptsCount] = useState(0);
  const [requiredCount, setRequiredCount] = useState(0);

  useEffect(() => {
    (async () => {
      // Try to claim admin if none exists (bootstrap)
      await supabase.rpc("claim_admin_if_none");
      const [{ data: f }, { data: s }, { data: p }] = await Promise.all([
        supabase.from("families").select("*").order("family_name"),
        supabase.from("submissions").select("*"),
        supabase.from("prompts").select("id, required"),
      ]);
      setFamilies((f ?? []) as Family[]);
      setSubs((s ?? []) as Submission[]);
      setPromptsCount((p ?? []).length);
      setRequiredCount((p ?? []).filter((x: any) => x.required).length);
    })();
  }, []);

  const pending = subs.filter((s) => s.review_status === "pending").length;
  const approved = subs.filter((s) => s.review_status === "approved").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Families" value={families.length} />
        <Stat label="Submissions" value={subs.length} />
        <Stat label="Pending review" value={pending} accent="destructive" />
        <Stat label="Approved" value={approved} accent="primary" />
      </div>

      <div className="temple-card overflow-hidden">
        <div className="border-b border-border px-5 py-3 flex items-center justify-between">
          <h2 className="font-serif text-lg text-primary">Family progress</h2>
          <Link to="/admin/families" className="text-xs text-primary underline">Manage</Link>
        </div>
        <div className="divide-y divide-border">
          {families.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No families yet. <Link to="/admin/families" className="underline">Add some</Link>.
            </p>
          )}
          {families.map((f) => {
            const fsubs = subs.filter((s) => s.family_id === f.id);
            const req = fsubs.length; // approximation
            return (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-foreground">{f.family_name}</p>
                  <p className="text-xs text-muted-foreground">Code · {f.access_code}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {req} / {promptsCount} prompts ({fsubs.filter(s => s.review_status === "approved").length} approved)
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Hunt has {requiredCount} required + {promptsCount - requiredCount} bonus prompts.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "primary" | "destructive" }) {
  return (
    <div className="temple-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent === "destructive" ? "text-destructive" : accent === "primary" ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
