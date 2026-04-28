import VideoBackground from "@/components/layout/VideoBackground";

/**
 * `/` is handled by middleware (guests → `/login`, signed-in → `/dashboard`).
 * This fallback only appears if middleware is disabled (e.g. missing `NEXTAUTH_SECRET`).
 */
export default function RootPage() {
  return (
    <div className="min-h-screen">
      <VideoBackground />
      <div className="content-layer flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center text-sm text-white/60">
        <p>Set `NEXTAUTH_SECRET` in `.env.local` to enable redirects.</p>
        <p>
          <a className="text-white underline" href="/login">
            Go to login
          </a>
        </p>
      </div>
    </div>
  );
}
