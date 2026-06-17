import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uploadPhoto } from "@/lib/storage";
import {
  downloadFromUrl,
  storagePathFromUrl,
  renderFamilyCollage,
  downloadBlob,
} from "@/lib/collage";
import type { Family, Prompt, Submission } from "@/lib/types";
import { toast } from "sonner";
import { Camera, Check, Download, Image as ImageIcon, Loader2, Sparkles, Trash2 } from "lucide-react";

import moroniLogo from "@/assets/moroni.png";

export const Route = createFileRoute("/family/$code")({ component: FamilyHunt });

function FamilyHunt() {
  const { code } = Route.useParams();
  const [family, setFamily] = useState<Family | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null);
  const [buildingCollage, setBuildingCollage] = useState(false);

  const refresh = async (familyId: string) => {
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("family_id", familyId);
    setSubs((data ?? []) as Submission[]);
  };

  useEffect(() => {
    (async () => {
      const [{ data: famRows }, { data: pr }, { data: combined }] = await Promise.all([
        supabase.rpc("get_family_by_code", { _code: code }),
        supabase.from("prompts").select("*").order("sort_order"),
        supabase
          .from("collages")
          .select("collage_url,updated_at")
          .eq("type", "combined")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const fam = Array.isArray(famRows) ? famRows[0] : famRows;
      if (!fam) { setLoading(false); return; }
      const famWithCode: Family = { id: fam.id, family_name: fam.family_name, access_code: code, created_at: "" };
      setFamily(famWithCode);
      setPrompts((pr ?? []) as Prompt[]);
      setCombinedUrl(combined?.collage_url ?? null);
      await refresh(fam.id);
      setLoading(false);
    })();
  }, [code]);

  const subByPrompt = useMemo(() => {
    const m = new Map<string, Submission>();
    subs.forEach((s) => m.set(s.prompt_id, s));
    return m;
  }, [subs]);

  const requiredPrompts = prompts.filter((p) => !p.is_bonus);
  const bonusPrompts = prompts.filter((p) => p.is_bonus);
  const requiredDone = requiredPrompts.filter((p) => subByPrompt.has(p.id)).length;
  const allRequiredDone = requiredDone === requiredPrompts.length && requiredPrompts.length > 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!family) {
    return (
      <div className="min-h-screen px-5 py-12 text-center">
        <h1 className="text-2xl font-semibold text-primary">Family not found</h1>
        <p className="mt-2 text-muted-foreground">Check your code with your group leader.</p>
        <Link to="/" className="mt-6 inline-block text-primary underline">Back home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-16 pt-6">
      <div className="mx-auto max-w-md">
        <header className="text-center">
          <img
            src={moroniLogo}
            alt="Angel Moroni"
            className="mx-auto h-20 w-auto drop-shadow-[0_4px_10px_rgba(184,151,95,0.35)]"
          />
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-primary/70">The {family.family_name} family</p>
          <h1 className="mt-1 text-2xl font-semibold text-primary">Temple Trip Hunt</h1>
        </header>

        <div className="temple-card mt-5 flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm text-muted-foreground">Required prompts</p>
            <p className="text-2xl font-semibold text-primary">{requiredDone} of {requiredPrompts.length}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-secondary/60 ring-4 ring-secondary/30 flex items-center justify-center">
            <span className="text-sm font-semibold text-secondary-foreground">
              {Math.round((requiredDone / Math.max(requiredPrompts.length, 1)) * 100)}%
            </span>
          </div>
        </div>

        {allRequiredDone && (
          <div className="temple-card mt-5 border-secondary bg-secondary/30 p-5 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-primary" />
            <h2 className="mt-2 font-serif text-xl text-primary">Great job!</h2>
            <p className="mt-1 text-sm text-foreground">
              You completed the scavenger hunt. Please return to the gathering spot. If you have time,
              try the bonus prompts below.
            </p>
          </div>
        )}

        {(() => {
          const approvedPhotos = subs
            .filter((s) => s.review_status === "approved" && s.include_in_family_collage)
            .map((s) => s.photo_url);
          const buildOwn = async () => {
            if (approvedPhotos.length === 0) {
              toast.error("No approved photos yet. Ask the leader to approve your photos first.");
              return;
            }
            setBuildingCollage(true);
            try {
              const blob = await renderFamilyCollage({
                familyName: family.family_name,
                photoUrls: approvedPhotos,
              });
              downloadBlob(blob, `temple-trip-${family.family_name.replace(/\s+/g, "-")}.png`);
              toast.success("Collage downloaded!");
            } catch (e: any) {
              toast.error(e.message || "Couldn't build collage");
            } finally {
              setBuildingCollage(false);
            }
          };
          if (approvedPhotos.length === 0 && !combinedUrl) return null;
          return (
            <section className="temple-card mt-5 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-serif text-lg text-primary">Your keepsakes</h2>
              </div>
              {approvedPhotos.length > 0 && (
                <button
                  onClick={buildOwn}
                  disabled={buildingCollage}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {buildingCollage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download my family collage
                </button>
              )}
              {combinedUrl && (
                <button
                  onClick={async () => {
                    try { await downloadFromUrl(combinedUrl, "temple-trip-combined.png"); }
                    catch (e: any) { toast.error(e.message || "Download failed"); }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground"
                >
                  <Download className="h-4 w-4" /> Download combined temple collage
                </button>
              )}
              <p className="text-xs text-muted-foreground text-center">
                Collages use your approved photos. Re-download anytime after new approvals.
              </p>
            </section>
          );
        })()}

        <section className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary/70">
            Required
          </h2>
          {requiredPrompts.map((p) => (
            <PromptCard
              key={p.id}
              prompt={p}
              family={family}
              submission={subByPrompt.get(p.id)}
              onChanged={() => refresh(family.id)}
            />
          ))}
        </section>

        {bonusPrompts.length > 0 && (
          <section className="mt-8 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-primary/70">
              Bonus
            </h2>
            {bonusPrompts.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
                family={family}
                submission={subByPrompt.get(p.id)}
                onChanged={() => refresh(family.id)}
              />
            ))}
          </section>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Photos stay private to this Primary temple trip keepsake.
        </p>
      </div>
    </div>
  );
}

function PromptCard({
  prompt,
  family,
  submission,
  onChanged,
}: {
  prompt: Prompt;
  family: Family;
  submission?: Submission;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState(submission?.caption ?? "");
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCaption(submission?.caption ?? ""); }, [submission?.id]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadPhoto(family.id, file);
      if (submission) {
        const { error } = await supabase.rpc("update_family_submission", {
          _code: family.access_code,
          _submission_id: submission.id,
          _patch: { photo_url: url, review_status: "pending" },
        });
        if (error) throw error;
        toast.success("Photo replaced");
      } else {
        const { error } = await supabase.rpc("create_family_submission", {
          _code: family.access_code,
          _prompt_id: prompt.id,
          _photo_url: url,
          _caption: caption || null,
        });
        if (error) throw error;
        toast.success("Photo uploaded");
      }
      onChanged();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const saveCaption = async () => {
    if (!submission) return;
    await supabase.rpc("update_family_submission", {
      _code: family.access_code,
      _submission_id: submission.id,
      _patch: { caption: caption || "" },
    });
    toast.success("Saved");
  };

  const done = !!submission;
  return (
    <article className={`temple-card overflow-hidden ${done ? "ring-1 ring-primary/20" : ""}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl text-primary">{prompt.title}</h3>
            {prompt.location_category && (
              <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                {prompt.location_category}
              </p>
            )}
          </div>
          {done && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Check className="h-3.5 w-3.5" /> Done
            </span>
          )}
        </div>
        <p className="mt-3 text-sm text-foreground">{prompt.instruction}</p>
        {prompt.helper_text && (
          <p className="mt-1.5 text-xs italic text-muted-foreground">{prompt.helper_text}</p>
        )}

        {submission && (
          <img
            src={submission.photo_url}
            alt={prompt.title}
            className="mt-4 aspect-[4/3] w-full rounded-lg object-cover"
          />
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {submission ? "Retake" : "Camera"}
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 py-2.5 text-sm font-medium text-secondary-foreground disabled:opacity-60"
          >
            <ImageIcon className="h-4 w-4" />
            {submission ? "Replace from library" : "Upload from library"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {submission && (
            <>
              <button
                onClick={async () => {
                  try {
                    await downloadFromUrl(submission.photo_url, `${prompt.title.replace(/\s+/g, "-")}.jpg`);
                  } catch (e: any) { toast.error(e.message || "Download failed"); }
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground"
                aria-label="Download photo"
              >
                <Download className="h-4 w-4" /> Download
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete the photo for "${prompt.title}"? This can't be undone.`)) return;
                  try {
                    const path = storagePathFromUrl(submission.photo_url);
                    const { error } = await supabase.from("submissions").delete().eq("id", submission.id);
                    if (error) throw error;
                    if (path) await supabase.storage.from("photos").remove([path]);
                    toast.success("Photo deleted");
                    onChanged();
                  } catch (e: any) { toast.error(e.message || "Delete failed"); }
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
                aria-label="Delete photo"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </>
          )}
        </div>


        {submission && (
          <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Approve for collages
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const next = submission.review_status === "approved" ? "pending" : "approved";
                  const { error } = await supabase
                    .from("submissions")
                    .update({ review_status: next })
                    .eq("id", submission.id);
                  if (error) { toast.error(error.message); return; }
                  toast.success(next === "approved" ? "Approved" : "Approval removed");
                  onChanged();
                }}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  submission.review_status === "approved"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground border border-input"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                {submission.review_status === "approved" ? "Approved" : "Approve photo"}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={submission.include_in_family_collage}
                  onChange={async (e) => {
                    const { error } = await supabase
                      .from("submissions")
                      .update({ include_in_family_collage: e.target.checked })
                      .eq("id", submission.id);
                    if (error) { toast.error(error.message); return; }
                    onChanged();
                  }}
                />
                Use in our family collage
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={submission.include_in_combined_collage}
                  onChange={async (e) => {
                    const { error } = await supabase
                      .from("submissions")
                      .update({ include_in_combined_collage: e.target.checked })
                      .eq("id", submission.id);
                    if (error) { toast.error(error.message); return; }
                    onChanged();
                  }}
                />
                Use in combined temple collage
              </label>
            </div>
          </div>
        )}

        {submission && (
          <div className="mt-3">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={saveCaption}
              placeholder="Add a short reflection (optional)"
              rows={2}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
        )}
      </div>
    </article>
  );
}
