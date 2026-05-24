import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Family, Submission } from "@/lib/types";
import { renderFamilyCollage, renderCombinedCollage, downloadBlob } from "@/lib/collage";
import { toast } from "sonner";
import { Download, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/admin/collages")({ component: Collages });

function Collages() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: s }] = await Promise.all([
        supabase.from("families").select("*").order("family_name"),
        supabase.from("submissions").select("*").eq("review_status", "approved"),
      ]);
      setFamilies((f ?? []) as Family[]);
      setSubs((s ?? []) as Submission[]);
    })();
  }, []);

  const familyPhotos = (id: string) =>
    subs.filter((s) => s.family_id === id && s.include_in_family_collage).map((s) => s.photo_url);

  const combinedPhotos = subs.filter((s) => s.include_in_combined_collage).map((s) => s.photo_url);

  const buildFamily = async (f: Family) => {
    const photos = familyPhotos(f.id);
    if (photos.length === 0) { toast.error("No approved photos for this family yet."); return; }
    setBusy(f.id);
    try {
      const blob = await renderFamilyCollage({ familyName: f.family_name, photoUrls: photos });
      setPreview(URL.createObjectURL(blob));
      downloadBlob(blob, `temple-trip-${f.family_name.replace(/\s+/g, "-")}.png`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const buildCombined = async () => {
    if (combinedPhotos.length === 0) { toast.error("No approved photos available."); return; }
    setBusy("combined");
    try {
      const blob = await renderCombinedCollage(combinedPhotos);
      setPreview(URL.createObjectURL(blob));
      downloadBlob(blob, "temple-trip-combined.png");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <section className="temple-card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-serif text-xl text-primary">Combined temple collage</h2>
            <p className="text-sm text-muted-foreground">
              {combinedPhotos.length} approved photos · arranged in a temple silhouette
            </p>
          </div>
          <button
            onClick={buildCombined}
            disabled={busy === "combined"}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy === "combined" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate & download
          </button>
        </div>
      </section>

      <section className="temple-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="font-serif text-xl text-primary">Per-family collages</h2>
        </div>
        <div className="divide-y divide-border">
          {families.map((f) => {
            const count = familyPhotos(f.id).length;
            return (
              <div key={f.id} className="flex items-center justify-between px-5 py-3 gap-3">
                <div>
                  <p className="font-medium text-foreground">{f.family_name}</p>
                  <p className="text-xs text-muted-foreground">{count} photos for collage</p>
                </div>
                <button
                  onClick={() => buildFamily(f)}
                  disabled={busy === f.id || count === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground disabled:opacity-50"
                >
                  {busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Generate
                </button>
              </div>
            );
          })}
          {families.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground">No families yet.</p>
          )}
        </div>
      </section>

      {preview && (
        <section className="temple-card p-3">
          <p className="px-2 pb-2 text-xs uppercase tracking-wider text-muted-foreground">Last preview</p>
          <img src={preview} alt="Collage preview" className="w-full rounded-lg" />
        </section>
      )}
    </div>
  );
}
