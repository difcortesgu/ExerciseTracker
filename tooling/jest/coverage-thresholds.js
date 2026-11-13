// @ts-check
const micromatch = require('micromatch');

/**
 * @typedef {{ lines?: number, branches?: number, functions?: number, statements?: number }} Threshold
 * @typedef {Record<string, Threshold>} ThresholdMap
 */

const GLOBAL_KEY = 'global';

/**
 * Keeps only the per-layer thresholds whose glob matches at least one source file.
 *
 * Jest fails with "Coverage data for <glob> was not found" when a threshold glob matches no
 * file, which would make an empty (not yet implemented) layer break the build for the wrong
 * reason. A threshold becomes active automatically as soon as the first file of its layer
 * exists, so it can never be forgotten. Matching uses micromatch, the same library Jest uses.
 *
 * @param {ThresholdMap} thresholds `global` plus one entry per layer glob
 * @param {readonly string[]} sourceFiles project-relative paths of files collected for coverage
 * @returns {ThresholdMap}
 */
function selectApplicableThresholds(thresholds, sourceFiles) {
  /** @type {ThresholdMap} */
  const applicable = {};
  for (const [key, threshold] of Object.entries(thresholds)) {
    if (key === GLOBAL_KEY || micromatch.some(sourceFiles, key)) {
      applicable[key] = threshold;
    }
  }
  return applicable;
}

module.exports = { selectApplicableThresholds };
