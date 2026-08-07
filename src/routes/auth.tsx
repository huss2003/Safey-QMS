import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Factory, ShieldCheck, GitBranch, BarChart3, Activity } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Minimum 6 characters"),
});
type FormValues = z.infer<typeof schema>;

/* ───── Floating particle background ───── */
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] =
      [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Create particles
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.3 + 0.05,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas!.width;
        if (p.x > canvas!.width) p.x = 0;
        if (p.y < 0) p.y = canvas!.height;
        if (p.y > canvas!.height) p.y = 0;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(30, 58, 138, ${p.alpha})`;
        ctx!.fill();
      });

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-hidden="true" />
  );
}

/* ───── Auth page ───── */
function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background overflow-hidden relative">
      {/* Left — premium hero panel */}
      <div className="hidden lg:flex flex-col relative bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#1E40AF] p-10 overflow-hidden">
        <ParticleBackground />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(30,58,138,0.3),transparent_60%)]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-sm text-white flex items-center justify-center shadow-lg border border-white/10">
              <Factory className="h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-[-0.005em] text-white">
                Safey
              </span>
              <span className="text-[10.5px] text-white/50 tracking-[0.04em] uppercase mt-0.5">
                Traceability
              </span>
            </div>
          </div>

          {/* Hero section */}
          <div className="flex-1 flex flex-col justify-center max-w-md mx-auto">
            <div className="animate-fade-in">
              <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-[1.15] text-white">
                From raw material to{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">
                  finished product
                </span>
                <br />— every batch captured.
              </h1>
            </div>
            <p className="mt-4 text-[14px] text-white/60 leading-relaxed max-w-sm animate-fade-up stagger-1">
              Track vendor sources, monitor wastage, plan production, and trace any finished unit
              back to its origin in seconds.
            </p>

            {/* Features */}
            <div className="mt-8 space-y-3 animate-fade-up stagger-2">
              {[
                { icon: GitBranch, text: "Forward and backward batch traceability" },
                { icon: BarChart3, text: "FIFO allocation with automatic stock deductions" },
                { icon: Activity, text: "Wastage logging and threshold alerts" },
                { icon: ShieldCheck, text: "Recall cascades across part and production batches" },
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-3 text-white/70 text-[13px]">
                  <div className="h-6 w-6 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <feat.icon className="h-3 w-3 text-white/80" />
                  </div>
                  <span>{feat.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-[11px] text-white/30">
            © {new Date().getFullYear()} Safey Medical Devices · v1.0
          </div>
        </div>
      </div>

      {/* Right — glass auth form */}
      <div className="relative flex items-center justify-center p-6 sm:p-10 bg-gradient-to-br from-background via-background to-secondary/30">
        {/* Decorative gradient blob */}
        <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] rounded-full bg-primary/5 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] rounded-full bg-secondary blur-[60px] pointer-events-none" />

        <div className="w-full max-w-sm relative animate-scale-in">
          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8 justify-center">
            <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Factory className="h-3.5 w-3.5" />
            </div>
            <span className="text-[14px] font-semibold tracking-[-0.005em]">
              Safey Traceability
            </span>
          </div>

          <Card className="glass !bg-card/80 border-border/60 shadow-lg">
            <CardHeader>
              <CardTitle className="text-[16px] font-semibold gradient-text">
                Sign in to your account
              </CardTitle>
              <p className="text-[12.5px] text-muted-foreground mt-1">
                Enter your credentials to continue
              </p>
            </CardHeader>
            <CardContent>
              <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
                <TabsList className="grid w-full grid-cols-2 h-9 rounded-lg bg-muted p-0.5">
                  <TabsTrigger
                    value="signin"
                    className="text-[12.5px] rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
                  >
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="text-[12.5px] rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all"
                  >
                    Sign up
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="signin" className="mt-4 animate-fade-in">
                  <AuthForm mode="signin" />
                </TabsContent>
                <TabsContent value="signup" className="mt-4 animate-fade-in">
                  <AuthForm mode="signup" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ───── Auth form ───── */
function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const [loading, setLoading] = useState(false);

  async function onSubmit(v: FormValues) {
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword(v);
        if (error) throw error;
        toast.success("Signed in");
      } else {
        const { error } = await supabase.auth.signUp({
          email: v.email,
          password: v.password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(
          "Check your inbox to confirm your email — or sign in if confirmations are disabled.",
        );
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
      <div className="space-y-1.5">
        <Label className="text-[12px] text-muted-foreground font-medium">Email</Label>
        <Input
          type="email"
          {...form.register("email")}
          className="h-9 text-[13px] border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
          placeholder="you@company.com"
        />
        {form.formState.errors.email && (
          <p className="text-[11px] text-destructive flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
            {form.formState.errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-[12px] text-muted-foreground font-medium">Password</Label>
        <Input
          type="password"
          {...form.register("password")}
          className="h-9 text-[13px] border-border/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
          placeholder="••••••••"
        />
        {form.formState.errors.password && (
          <p className="text-[11px] text-destructive flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
            {form.formState.errors.password.message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        className="w-full h-9 text-[13px] rounded-lg shadow-sm hover:shadow-md transition-all"
        disabled={loading}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
        {mode === "signin" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
