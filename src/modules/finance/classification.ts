import type {
  ClassificationMetrics,
  ClassificationResult,
  ClassificationRule,
  OpportunitySignal,
  PredicateEvaluation,
  RuleOperator,
} from "./contracts";

const SIGNAL_RANK: Readonly<Record<OpportunitySignal, number>> = {
  REJECT: 0,
  WATCH: 1,
  BUY: 2,
  STRONG_BUY: 3,
};

function compare(
  actual: import("decimal.js").default,
  expected: import("decimal.js").default,
  operator: RuleOperator,
): boolean {
  switch (operator) {
    case "GT":
      return actual.greaterThan(expected);
    case "GTE":
      return actual.greaterThanOrEqualTo(expected);
    case "LT":
      return actual.lessThan(expected);
    case "LTE":
      return actual.lessThanOrEqualTo(expected);
    case "EQ":
      return actual.equals(expected);
  }
}

export function capSignal(
  signal: OpportunitySignal,
  cap: OpportunitySignal,
): OpportunitySignal {
  return SIGNAL_RANK[signal] <= SIGNAL_RANK[cap] ? signal : cap;
}

export function classifyOpportunity(args: {
  readonly metrics: ClassificationMetrics;
  readonly rules: readonly ClassificationRule[];
  readonly signalCap?: OpportunitySignal;
  readonly forcedRejectReason?: string;
}): ClassificationResult {
  const enabledRules = args.rules
    .filter((rule) => rule.enabled)
    .sort((left, right) => {
      const priorityComparison = right.priority - left.priority;
      return priorityComparison !== 0
        ? priorityComparison
        : left.id.localeCompare(right.id);
    });
  const identifiers = new Set<string>();
  for (const rule of enabledRules) {
    if (identifiers.has(rule.id)) {
      throw new RangeError(`Duplicate classification rule id: ${rule.id}`);
    }
    identifiers.add(rule.id);
    if (rule.all.length === 0) {
      throw new RangeError(`Classification rule ${rule.id} has no predicates`);
    }
    if (!Number.isFinite(rule.priority)) {
      throw new RangeError(`Classification rule ${rule.id} has invalid priority`);
    }
  }

  const evaluations = enabledRules.map((rule) => {
    const predicates: PredicateEvaluation[] = rule.all.map((predicate) => {
      const actual = args.metrics[predicate.metric];
      return {
        predicate,
        actual,
        passed:
          actual === undefined
            ? false
            : compare(actual, predicate.value, predicate.operator),
      };
    });
    return {
      ruleId: rule.id,
      signal: rule.signal,
      passed: predicates.every((predicate) => predicate.passed),
      predicates,
    };
  });

  const matched = evaluations.find((evaluation) => evaluation.passed);
  const candidateSignal: OpportunitySignal = matched?.signal ?? "REJECT";
  let signal = candidateSignal;
  if (args.signalCap !== undefined) {
    signal = capSignal(signal, args.signalCap);
  }
  if (args.forcedRejectReason !== undefined) {
    signal = "REJECT";
  }

  return {
    candidateSignal,
    signal,
    matchedRuleId: matched?.ruleId,
    evaluations,
    appliedCap: args.signalCap,
    forcedRejectReason: args.forcedRejectReason,
  };
}

export function opportunitySignalRank(signal: OpportunitySignal): number {
  return SIGNAL_RANK[signal];
}
