import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg p-6 text-fg">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Stinky Kart
          </p>
          <h1 className="text-2xl font-black">Sign in</h1>
          <p className="text-sm text-muted">
            Optional — race as a guest anytime.
          </p>
        </div>
        {authEnabled ? (
          GROK_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 font-semibold transition hover:border-primary hover:bg-primary/10"
            >
              Continue with {p.label}
            </button>
          ))
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link
          to="/"
          className="block text-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Back to race
        </Link>
      </div>
    </main>
  );
}
