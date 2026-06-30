export { default as HintsPanel } from "./ui/HintsPanel.svelte";
export {
  computeHints,
  rankHints,
  pruneSnoozed,
  DEFAULT_TOP_N,
} from "./lib/compute-hints";
export { HINT_RULES } from "./lib/hint-rules";
export type {
  Hint,
  HintInput,
  HintRule,
  HintMatch,
  HintSeverity,
  HintAction,
} from "./lib/types";
