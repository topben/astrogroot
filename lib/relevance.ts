/**
 * Shared relevance classifier for arXiv papers, used by both the crawler
 * (pre-AI-spend filter) and the offline purge script, so "what counts as
 * on-topic" is defined in exactly one place.
 *
 * Site pillars: astronomy/space, rocketry, robotics (general), and AI
 * applied to any of those. Everything else (generic ML, control theory,
 * optimization, NLP, etc. with no space/robot connection) is dropped.
 */

// arXiv categories where the category itself implies relevance - no
// keyword match needed.
export const ASTRO_SPACE_CATEGORIES = [
  "astro-ph.CO",
  "astro-ph.EP",
  "astro-ph.GA",
  "astro-ph.HE",
  "astro-ph.IM",
  "astro-ph.SR",
  "gr-qc",
  "physics.space-ph",
] as const;

const ROBOTICS_CATEGORY = "cs.RO";

// arXiv categories broad enough that they need a keyword match to count -
// these span far more than space/robotics (e.g. cs.LG covers all of ML).
const AI_CATEGORIES = new Set(["cs.AI", "cs.LG", "cs.CV", "cs.CL", "cs.NE", "stat.ML"]);

const SPACE_KEYWORDS =
  /rocket|propuls|propellant|thruster|turbopump|nozzle|combust|launch vehicle|hypersonic|scramjet|ablat|spacecraft|satellit|lunar|\bmars\b|asteroid|comet|nebula|exoplanet|space station|space debris|reentry|entry descent|astronaut|microgravity|deep space|space mission|space explor|cosmic|\buniverse\b|\bcosmos\b|galax|stellar|star formation|binary star|variable star|star cluster|host star|astronom|astrophys|black hole|supernova|telescope|dark matter|dark energy|gravitational wave|quasar|pulsar|accretion disk|interstellar|white dwarf|neutron star|redshift|\biss\b|\bnasa\b|\besa\b|thrust vector|thrust.{0,4}control|thrust.{0,4}magnitude|regenerative cooling|injector design|aerothermodynamic|thermal protection system|flight dynamics|guidance.{0,3}navigation|powered descent|orbital (mechanics|debris|decay|insertion|maneuver|rendezvous|dynamics|period)|orbit determination|earth orbit|geostationary|sun-synchronous|\borbiter\b|delta-v|specific impulse|\bisp\b|low-thrust trajectory/i;

const ROBOTICS_KEYWORDS =
  /\brobot|\brover\b|manipulat|teleoperat|\bgrasp|actuat|humanoid|\bslam\b|motion planning|exoskeleton|legged|bipedal|quadruped|dexterous|sim-to-real|whole-body control|visuomotor|vision-language-action|\bvla\b|imitation learning|end.effector/i;

export type RelevanceTopic = "astro" | "space" | "robotics" | "ai-astro" | "ai-robotics";

export interface ClassifiableInput {
  title: string;
  abstract: string;
  categories: string[];
}

export interface ClassificationResult {
  keep: boolean;
  topic: RelevanceTopic | null;
}

/** Classify an arXiv paper as on-topic (keep) or off-topic (drop). Not for NTRS reports - those are already keyword-targeted at collection time. */
export function classifyPaper(input: ClassifiableInput): ClassificationResult {
  const text = `${input.title} ${input.abstract}`;
  const isAstroCat = input.categories.some((c) =>
    (ASTRO_SPACE_CATEGORIES as readonly string[]).includes(c)
  );
  const isRoboticsCat = input.categories.includes(ROBOTICS_CATEGORY);
  const isAiCat = input.categories.some((c) => AI_CATEGORIES.has(c));
  const hasSpaceKeyword = SPACE_KEYWORDS.test(text);
  const hasRoboticsKeyword = ROBOTICS_KEYWORDS.test(text);

  // AI-tagged first, so AI∩(astro|robotics) papers get labeled distinctly
  // even though they'd also satisfy the plain astro/robotics rules below.
  if (isAiCat && (isAstroCat || hasSpaceKeyword)) return { keep: true, topic: "ai-astro" };
  if (isAiCat && (isRoboticsCat || hasRoboticsKeyword)) return { keep: true, topic: "ai-robotics" };
  if (isAstroCat) return { keep: true, topic: "astro" };
  if (hasSpaceKeyword) return { keep: true, topic: "space" };
  if (isRoboticsCat || hasRoboticsKeyword) return { keep: true, topic: "robotics" };

  return { keep: false, topic: null };
}
