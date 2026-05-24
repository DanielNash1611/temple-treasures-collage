import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Family } from "@/lib/types";
import { toast } from "sonner";
import { Trash2, Printer } from "lucide-react";

export const Route = createFileRoute("/admin/families")({ component: Families });

function genCode(name: string) {
  const base = name.replace(/[^a-zA-Z]/g, "").slice(0, 6).toUpperCase() || "FAM";
  const n = Math.floor(10 + Math.random() * 89);
  return `${base}-${n}`;
}

function Families() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("families").select("*").order("family_name");
    setFamilies((data ?? []) as Family[]);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const access_code = (code.trim() || genCode(name)).toUpperCase();
    const { error } = await supabase.from("families").insert({ family_name: name.trim(), access_code });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setName(""); setCode("");
    toast.success("Family added");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this family and all their photos?")) return;
    const { error } = await supabase.from("families").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); load(); }
  };

  const rename = async (id: string, family_name: string) => {
    await supabase.from("families").update({ family_name }).eq("id", id);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="temple-card grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto]">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Family name (e.g. Smith)" className="rounded-lg border border-input bg-background px-3 py-2" />
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code (optional)" className="rounded-lg border border-input bg-background px-3 py-2" />
        <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">Add</button>
      </form>

      <div className="flex justify-end">
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm">
          <Printer className="h-4 w-4" /> Print code list
        </button>
      </div>

      <div className="temple-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Family</th>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Link</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {families.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-2">
                  <input defaultValue={f.family_name} onBlur={(e) => rename(f.id, e.target.value)} className="w-full bg-transparent" />
                </td>
                <td className="px-4 py-2 font-mono">{f.access_code}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground break-all">
                  {origin}/family/{f.access_code}
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(f.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {families.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No families yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
