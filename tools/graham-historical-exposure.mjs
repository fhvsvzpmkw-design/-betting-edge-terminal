// Explicit Graham time-exposure estimate. This is not medical effectiveness.
const fail = message => { throw new Error(message); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const round = value => Number(value.toFixed(3));

export function historicalExposure(input, sourceCheck) {
  if (input?.modelId !== 'graham-historical-time-exposure-v1' || input.estimateAcknowledged !== true ||
      !text(input.assumptionRationale) || input.activeEffectivenessConvention !== 'NORMAL_WHILE_ACTIVE_ESTIMATE') {
    fail('EXPOSURE_ESTIMATE_DECLARATION_REQUIRED');
  }
  const duration = input.gameDurationSeconds;
  if (!finite(duration) || duration < 3600 || duration > 4200) fail('EXPOSURE_GAME_DURATION_REQUIRED');
  sourceCheck(input.durationSourceIds);
  if (!Array.isArray(input.unavailableIntervals) || !input.unavailableIntervals.length) fail('EXPOSURE_INTERVALS_REQUIRED');
  let previousLatestEnd = 0, minimum = 0, maximum = 0;
  const intervals = input.unavailableIntervals.map(interval => {
    const {startEarliest, startLatest, endEarliest, endLatest} = interval;
    if (![startEarliest, startLatest, endEarliest, endLatest].every(finite) ||
        startEarliest < previousLatestEnd || startEarliest > startLatest || startLatest > endEarliest ||
        endEarliest > endLatest || endLatest > duration || !text(interval.rationale)) fail('EXPOSURE_INTERVAL_INVALID');
    sourceCheck(interval.sourceIds);
    previousLatestEnd = endLatest;
    minimum += endEarliest - startLatest;
    maximum += endLatest - startEarliest;
    return {...interval};
  });
  return {modelId: input.modelId, classification: 'GRAHAM_MODEL_ESTIMATE',
    fraction: (minimum + maximum) / (2 * duration), fractionRange: {min: minimum / duration, max: maximum / duration},
    unavailableIntervals: intervals, gameDurationSeconds: duration,
    assumptionRationale: input.assumptionRationale, activeEffectivenessConvention: input.activeEffectivenessConvention,
    limitation: 'Elapsed game time approximates lost role exposure; interval midpoint is an explicit estimate when timing is imprecise. This does not estimate medical impairment or infer injury from snap share.'};
}

export function exposureWeightedLoss(healthyValue, replacementValue, exposure) {
  if (![healthyValue, replacementValue].every(finite) || healthyValue < 0 || replacementValue < 0 ||
      !finite(exposure?.fraction) || exposure.fraction < 0 || exposure.fraction > 1) fail('EXPOSURE_VALUES_REQUIRED');
  const fullLoss = Math.max(0, healthyValue - replacementValue);
  const injuryLoss = round(fullLoss * exposure.fraction);
  return {injuryLoss, rawTeamContributionDelta: -injuryLoss, healthyValue, replacementValue,
    fullGameLoss: fullLoss, exposure,
    injuryLossRange: {min: round(fullLoss * exposure.fractionRange.min), max: round(fullLoss * exposure.fractionRange.max)}};
}
