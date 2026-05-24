import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Family, Prompt, ReviewStatus, Submission } from "@/lib/types";
import { toast } from "sonner";
import { Check, X, Trash2, Download } from "lucide-react";
import { downloadFromUrl, storagePathFromUrl } from "@/lib/collage";

export const Route = createFileRoute("/admin/review")({ component: Review });

function Review() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [filterFamily, setFilterFamily] = useState("");
  const [filterPrompt, setFilterPrompt] = useState("");
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | "">("");

  const load = async () => {
    const [{ data: s }, { data: f }, { data: p }] = await Promise.all([
      supabase.from("submissions").select("*").order("created_at", { ascending: false }),
      supabase.from("families").select("*").order("family_name"),
      supabase.from("prompts").select("*").order("sort_order"),
    ]);
    setSubs((s ?? []) as Submission[]);
    setFamilies((f ?? []) as Family[]);
    setPrompts((p ?? []) as Prompt[]);
  };
  useEffect(() => { load(); }, []);

  const famName = (id: string) => families.find((f) => f.id === id)?.family_name ?? "—";
  const promptTitle = (id: string) => prompts.find((p) => p.id === id)?.title ?? "—";

  const filtered = useMemo(() => subs.filter((s) =>
    (!filterFamily || s.family_id === filterFamily) &&
    (!filterPrompt || s.prompt_id === filterPrompt) &&
    (!filterStatus || s.review_status === filterStatus)
  ), [subs, filterFamily, filterPrompt, filterStatus]);

  const update = async (id: string, patch: Partial<Submission>) => {
    const { error } = await supabase.from("submissions").update(patch).eq("id", id);
    if (error) toast.error(error.message); else { load(); }
  };
  const remove = async (id: string, url: string) => {
    if (!confirm("Permanently delete this submission? This removes the photo from storage and any collage.")) return;
    const path = storagePathFromUrl(url);
    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (path) await supabase.storage.from("photos").remove([path]);
    toast.success("Deleted");
    load();
  };
  const download = async (url: string, name: string) => {
    try { await downloadFromUrl(url, `${name.replace(/\s+/g, "-")}.jpg`); }
    catch (e: any) { toast.error(e.message || "Download failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="temple-card flex flex-wrap gap-2 p-3 text-sm">
        <select value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2">
          <option value="">All families</option>
          {families.map((f) => <option key={f.id} value={f.id}>{f.family_name}</option>)}
        </select>
        <select value={filterPrompt} onChange={(e) => setFilterPrompt(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2">
          <option value="">All prompts</option>
          {prompts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="rounded-lg border border-input bg-background px-3 py-2">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <article key={s.id} className="temple-card overflow-hidden">
            <img src={s.photo_url} alt="" className="aspect-[4/3] w-full object-cover" />
            <div className="p-3 space-y-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{famName(s.family_id)}</p>
                <p className="font-serif text-base text-primary">{promptTitle(s.prompt_id)}</p>
              </div>
              {s.caption && <p className="text-xs italic text-muted-foreground">"{s.caption}"</p>}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => update(s.id, { review_status: "approved" })}
                  className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium ${s.review_status === "approved" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  onClick={() => update(s.id, { review_status: "rejected" })}
                  className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium ${s.review_status === "rejected" ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground"}`}
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
                <button onClick={() => remove(s.id)} className="rounded-lg bg-muted p-1.5 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={s.include_in_family_collage} onChange={(e) => update(s.id, { include_in_family_collage: e.target.checked })} />
                  In family collage
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={s.include_in_combined_collage} onChange={(e) => update(s.id, { include_in_combined_collage: e.target.checked })} />
                  In combined
                </label>
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No submissions match.</p>
        )}
      </div>
    </div>
  );
}
