import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, MessageCircle, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trusty — Real people. Real conversations. No bots." },
      { name: "description", content: "Join a chat community where every account is verified by email or phone. Public rooms, private messages, groups, file sharing, real-time." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand shadow-glow">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </span>
          Trusty
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/auth" className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent">Sign in</Link>
          <Link to="/auth" search={{ mode: "signup" }} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-95">
            Create account
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-status-online animate-pulse" />
            Every account verified
          </div>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Real people.<br />
            <span className="text-gradient-brand">Real conversations.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            A community chat where every user is verified by email, Google, or phone — but your contact details stay private. Just a username and your unique ID.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-95">
              Get your verified profile
            </Link>
            <Link to="/auth" className="rounded-lg border border-border bg-card/60 px-6 py-3 text-sm font-semibold hover:bg-accent">
              I already have an account
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, title: "Verified profiles", body: "Every member verifies by email, Google, or phone. No bots, no throwaway accounts." },
            { icon: MessageCircle, title: "Real-time rooms & DMs", body: "Public rooms, private messages, group chats — everything streams live." },
            { icon: Users, title: "See who's online", body: "Live presence sidebar. Find friends, send a request, start a conversation." },
            { icon: Sparkles, title: "Reactions & files", body: "React with emoji, share images and files, search people by name or ID." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur shadow-soft">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-display font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-20 max-w-2xl rounded-2xl border border-border bg-card/60 p-6 text-center backdrop-blur shadow-soft">
          <p className="text-sm text-muted-foreground">Your public profile looks like</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full bg-brand grid place-items-center font-display font-bold text-primary-foreground">A</div>
            <div className="text-left">
              <div className="flex items-center gap-2 font-semibold">
                AlexGamer
                <span className="inline-flex items-center gap-1 rounded-full bg-verified/15 px-2 py-0.5 text-[10px] font-semibold text-verified">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              </div>
              <div className="text-xs text-muted-foreground">#58291 · <span className="text-status-online">● Online</span></div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Your email and phone stay private. Always.</p>
        </div>
      </main>
    </div>
  );
}
