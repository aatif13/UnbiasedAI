"use client";

import Link from "next/link";
import { ArrowRight, AtSign, BarChart2, GitBranch, Globe, Menu, Scale, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import VideoBackground from "@/components/layout/VideoBackground";
import { Button } from "@/components/ui/button";

/** Public marketing landing (not behind auth). */
export default function MarketingHomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <VideoBackground />
      <div className="content-layer min-h-screen px-3 py-4 lg:px-6 lg:py-6">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[52fr_48fr]">
          <section className="relative overflow-hidden rounded-[2rem]">
            <div className="liquid-glass-strong absolute inset-1 rounded-[2rem]" />
            <div className="relative z-10 flex h-full flex-col p-5 lg:p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <div className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full">
                    <Shield className="h-5 w-5" />
                  </div>
                  <span className="font-display text-xl font-medium tracking-tight">UnbiasedAI</span>
                </div>
                <div className="liquid-glass glass-pill flex items-center gap-2 text-xs text-white/80">
                  <Menu className="h-3.5 w-3.5" />
                  Menu
                </div>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                <div className="liquid-glass flex h-20 w-20 items-center justify-center rounded-full">
                  <Shield className="h-10 w-10 text-white" />
                </div>
                <h1 className="max-w-3xl text-5xl font-medium tracking-[-0.05em] text-white lg:text-7xl">
                  Detecting
                  <span className="font-serif italic text-white/80"> hidden bias </span>
                  before it harms
                </h1>
                <p className="max-w-xs text-base text-white/60">
                  AI-powered fairness auditing for every dataset and model.
                </p>
                <Button
                  type="button"
                  className="glass-pill liquid-glass-strong flex items-center gap-2 px-6 py-6 text-sm font-medium text-white"
                  onClick={() => router.push("/audit/new")}
                  data-testid="cta-start-audit"
                >
                  Start Free Audit
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                    <ArrowRight className="h-4 w-4 text-white" />
                  </span>
                </Button>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  {["Bias Detection", "12 Fairness Metrics", "Legal Compliance"].map((item) => (
                    <span key={item} className="liquid-glass glass-pill text-white/80">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-white/50">Fairness by design</p>
                <p className="text-sm text-white/70">
                  <span className="font-display">We build systems that </span>
                  <span className="font-serif italic text-white/80">treat everyone equally.</span>
                </p>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/40">
                  <span className="h-px flex-1 bg-white/20" />
                  <span>UnbiasedAI Platform</span>
                  <span className="h-px flex-1 bg-white/20" />
                </div>
              </div>
            </div>
          </section>

          <section className="hidden flex-col gap-4 lg:flex">
            <div className="flex items-center justify-between">
              <div className="liquid-glass glass-pill flex items-center gap-3 text-white/70">
                <GitBranch className="h-4 w-4" />
                <AtSign className="h-4 w-4" />
                <Globe className="h-4 w-4" />
                <ArrowRight className="h-4 w-4" />
              </div>
              <Button asChild variant="secondary" className="glass-pill">
                <Link href="/login">Sign In</Link>
              </Button>
            </div>

            <div className="liquid-glass rounded-2xl p-4 text-white/80">
              <h3 className="text-sm font-medium text-white">Live audit insights</h3>
              <p className="mt-1 text-xs text-white/60">Real-time fairness diagnostics across regulated workflows.</p>
              <div className="mt-3 space-y-2 text-xs text-white/70">
                <p>48k+ datasets analyzed</p>
                <p>12 bias metrics</p>
                <p>3 compliance frameworks</p>
              </div>
            </div>

            <div className="liquid-glass-strong mt-auto rounded-[2.5rem] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="liquid-glass rounded-3xl p-4">
                  <Scale className="h-6 w-6 text-white/80" />
                  <p className="mt-3 text-sm font-medium text-white">Fairness Engine</p>
                  <p className="mt-1 text-xs text-white/60">Detects 12 bias metrics</p>
                </div>
                <div className="liquid-glass rounded-3xl p-4">
                  <Shield className="h-6 w-6 text-white/80" />
                  <p className="mt-3 text-sm font-medium text-white">Compliance Guard</p>
                  <p className="mt-1 text-xs text-white/60">EEOC, GDPR, EU AI Act</p>
                </div>
              </div>

              <div className="liquid-glass mt-3 flex items-center gap-3 rounded-2xl p-4">
                <div className="liquid-glass flex h-16 w-24 items-center justify-center rounded-xl">
                  <BarChart2 className="h-8 w-8 text-white/60" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Advanced Bias Analysis</p>
                  <p className="text-xs text-white/60">Actionable remediation with confidence-aware ranking.</p>
                </div>
                <button type="button" className="liquid-glass glass-btn flex h-7 w-7 items-center justify-center rounded-full text-white">
                  +
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
