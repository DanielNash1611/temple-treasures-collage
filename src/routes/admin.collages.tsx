import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Family, Submission } from "@/lib/types";
import { renderFamilyCollage, renderCombinedCollage, downloadBlob } from "@/lib/collage";
import { toast } from "sonner";
import { Download, Image as ImageIcon, Loader2, Sparkles, X } from "lucide-react";

export const Route = createFileRoute("/admin/collages")({ component: Collages });

function Collages() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const refFileRef = useRef<HTMLInputElement>(null);

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
      const blob = await renderCombinedCollage(combinedPhotos, {
        referenceImageUrl: referenceUrl,
      });
      setPreview(URL.createObjectURL(blob));
      downloadBlob(blob, "temple-trip-combined.png");

      // Share with families: upload to storage and upsert collages row.
      try {
        const path = `collages/combined-${Date.now()}.png`;
        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(path, blob, { contentType: "image/png", upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
        await supabase.from("collages").insert({
          type: "combined",
          collage_url: pub.publicUrl,
        });
        toast.success("Combined collage shared with families.");
      } catch (e: any) {
        toast.error(`Saved locally, but couldn't share: ${e.message}`);
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  const onPickReference = (file: File) => {
    const url = URL.createObjectURL(file);
    setReferenceUrl(url);
    toast.success("Reference image loaded — it will guide the silhouette.");
  };

  return (
    <div className="space-y-6">
      <section className="temple-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-serif text-xl text-primary">Combined temple collage</h2>
            <p className="text-sm text-muted-foreground">
              {combinedPhotos.length} approved photos · LA Temple silhouette with Moroni topper
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

        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium text-foreground">Optional: silhouette reference image</p>
          <p className="text-xs text-muted-foreground">
            Upload a photo or outline of the Los Angeles Temple. It won't appear in the collage —
            it's used to shape the silhouette where photos are tiled. If skipped, the built-in
            LA Temple template is used.
          </p>
          <input
            ref={refFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickReference(f);
              e.target.value = "";
            }}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => refFileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
            >
              <ImageIcon className="h-4 w-4" /> {referenceUrl ? "Replace reference" : "Upload reference"}
            </button>
            {referenceUrl && (
              <>
                <img src={referenceUrl} alt="" className="h-10 w-16 rounded object-cover" />
                <button
                  onClick={() => setReferenceUrl(null)}
                  className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              </>
            )}
          </div>
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
