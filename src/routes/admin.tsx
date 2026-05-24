import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const [state, setState] = useState<"loading" | "in" | "out">("loading");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const loc = useLocation();

  const checkRole = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) { setState("out"); return; }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    if (data) setState("in");
    else { await supabase.auth.signOut(); setState("out"); setErr("Account is not an admin."); }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { checkRole(); });
    checkRole();
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) setErr(error.message);
  };

  const signUp = async () => {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.auth.signUp({
      email, password: pw,
      options: { emailRedirectTo: window.location.origin + "/admin" },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (data.user) {
      // Try to add admin role (will fail if there's already an admin via RLS-protected insert; but no insert policy exists, so this will fail safely).
      // Use rpc workaround: allow first admin via direct insert by leveraging service-role through migration is preferred.
      // Show message:
      setErr("Account created. Ask the existing admin to grant your account the admin role, or set it manually in the database.");
    }
  };

  if (state === "loading") {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (state === "out") {
    return (
      <div className="min-h-screen px-5 py-12">
        <div className="mx-auto max-w-sm">
          <h1 className="text-center text-2xl font-semibold text-primary">Admin sign in</h1>
          <form onSubmit={signIn} className="temple-card mt-6 space-y-3 p-5">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-input bg-background px-3 py-2.5" />
            <input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className="w-full rounded-lg border border-input bg-background px-3 py-2.5" />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground disabled:opacity-60">
              {busy ? "…" : "Sign in"}
            </button>
            <button type="button" onClick={signUp} disabled={busy} className="w-full text-sm text-muted-foreground underline">
              Create admin account
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="underline">Back to family hunt</Link>
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { to: "/admin", label: "Overview" },
    { to: "/admin/families", label: "Families" },
    { to: "/admin/review", label: "Review" },
    { to: "/admin/collages", label: "Collages" },
  ] as const;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="font-serif text-xl text-primary">Temple Trip · Admin</h1>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-muted-foreground underline">Sign out</button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2">
          {tabs.map((t) => {
            const active = loc.pathname === t.to || (t.to !== "/admin" && loc.pathname.startsWith(t.to));
            return (
              <Link key={t.to} to={t.to} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
