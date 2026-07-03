import { assertEquals } from "jsr:@std/assert@1";
import { classifyPaper } from "./relevance.ts";

Deno.test("relevance: keeps astro-category papers regardless of text", () => {
  const r = classifyPaper({
    title: "Holographic generative flows with AdS/CFT",
    abstract: "We study cosmological implications of holography.",
    categories: ["gr-qc"],
  });
  assertEquals(r.keep, true);
  assertEquals(r.topic, "astro");
});

Deno.test("relevance: keeps papers with space keywords outside astro categories", () => {
  const r = classifyPaper({
    title: "Turbopump cavitation in liquid rocket engines",
    abstract: "We analyze regenerative cooling in a rocket propulsion system.",
    categories: ["physics.flu-dyn"],
  });
  assertEquals(r.keep, true);
  assertEquals(r.topic, "space");
});

Deno.test("relevance: keeps cs.RO papers even without space keywords (robotics pillar)", () => {
  const r = classifyPaper({
    title: "HumanX: Toward Agile and Generalizable Humanoid Interaction Skills from Human Video",
    abstract: "We present a framework for learning humanoid manipulation skills from video.",
    categories: ["cs.RO", "cs.LG"],
  });
  assertEquals(r.keep, true);
  assertEquals(r.topic, "ai-robotics");
});

Deno.test("relevance: tags AI-category + space keyword as ai-astro", () => {
  const r = classifyPaper({
    title: "Deep learning for exoplanet transit detection",
    abstract: "A convolutional neural network trained on Kepler light curves.",
    categories: ["cs.LG"],
  });
  assertEquals(r.keep, true);
  assertEquals(r.topic, "ai-astro");
});

Deno.test("relevance: drops generic control theory with no space/robot connection", () => {
  const r = classifyPaper({
    title: "Robust Safety-Critical Control of Networked SIR Dynamics",
    abstract: "We study epidemic spread control using Lyapunov methods.",
    categories: ["eess.SY"],
  });
  assertEquals(r.keep, false);
  assertEquals(r.topic, null);
});

Deno.test("relevance: drops generic optimization papers", () => {
  const r = classifyPaper({
    title: "Maximizing Reliability with Bayesian Optimization",
    abstract: "We propose a Bayesian optimization method for reliability engineering.",
    categories: ["cs.LG", "math.OC", "stat.ML"],
  });
  assertEquals(r.keep, false);
  assertEquals(r.topic, null);
});

Deno.test("relevance: drops generic robotics-adjacent scheduling with no robot/space content", () => {
  const r = classifyPaper({
    title: "Preemptive Scheduling for Age of Job Minimization in Task-Specific Machine Networks",
    abstract: "We study scheduling policies for distributed computing networks.",
    categories: ["cs.IT", "cs.NI", "eess.SY"],
  });
  assertEquals(r.keep, false);
  assertEquals(r.topic, null);
});

Deno.test("relevance: keeps rocket powered-descent guidance papers (math.OC/eess.SY, no astro category)", () => {
  const r = classifyPaper({
    title: "Sequential Convex Programming for 6-DoF Powered Descent Guidance with Continuous-Time Compound State-Triggered Constraints",
    abstract: "This paper presents a sequential convex programming framework for powered descent guidance.",
    categories: ["eess.SY"],
  });
  assertEquals(r.keep, true);
  assertEquals(r.topic, "space");
});

Deno.test("relevance: keeps low-thrust spacecraft trajectory design papers (math.OC only)", () => {
  const r = classifyPaper({
    title: "Comparison of control regularization techniques for minimum-fuel low-thrust trajectory design using indirect methods",
    abstract: "Minimum-fuel low-thrust trajectories typically consist of a finite number of switches in the thrust magnitude profile.",
    categories: ["math.OC"],
  });
  assertEquals(r.keep, true);
  assertEquals(r.topic, "space");
});

Deno.test("relevance: drops accessibility tool with generic 'navigation controls' UI term", () => {
  const r = classifyPaper({
    title: "StreetReaderAI: Making Street View Accessible Using Context-Aware Multimodal AI",
    abstract: "We introduce StreetReaderAI, which combines context-aware multimodal AI, accessible navigation controls, and conversational speech for blind users exploring Google Street View.",
    categories: ["cs.HC", "cs.AI"],
  });
  assertEquals(r.keep, false, "generic UI 'navigation controls' must not match the aerospace guidance/navigation/control keyword");
});

Deno.test("relevance: still drops generic motor control with no space connection", () => {
  const r = classifyPaper({
    title: "Computationally Efficient Near-Optimal Control for Current Ripple Reduction and Optimization of Three-Phase Motors via LMIs",
    abstract: "The optimal control of three-phase permanent-magnet synchronous motors is challenging.",
    categories: ["math.OC", "eess.SY"],
  });
  assertEquals(r.keep, false);
  assertEquals(r.topic, null);
});

Deno.test("relevance: keeps cs.CV paper about robot manipulation as ai-robotics", () => {
  const r = classifyPaper({
    title: "SoMA: A Real-to-Sim Neural Simulator for Robotic Soft-body Manipulation",
    abstract: "We build a differentiable simulator for soft-body robotic manipulation.",
    categories: ["cs.RO", "cs.AI", "cs.CV", "physics.app-ph"],
  });
  assertEquals(r.keep, true);
  assertEquals(r.topic, "ai-robotics");
});
