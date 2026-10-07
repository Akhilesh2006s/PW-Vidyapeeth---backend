import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSessionSatisfaction } from '../src/services/parentService.js';

test('parent satisfaction rewards positive sentiment, addressed objections and coverage', () => {
  const result = calculateSessionSatisfaction({
    isPlaceholder: false,
    sentimentIndicators: [{ aspect: 'confidence', indicator: 'Parent is satisfied and confident', intensity: 'high' }],
    objections: [{ objection: 'Fees', status: 'addressed' }],
    coveredPoints: [{ point: 'Fees' }, { point: 'Safety' }],
    missedPoints: [],
  });
  assert.equal(result.score, 84);
  assert.match(result.reasons.join(' '), /Positive signal/);
});

test('parent satisfaction penalises negative sentiment, open objections and missed coverage', () => {
  const result = calculateSessionSatisfaction({
    isPlaceholder: false,
    sentimentIndicators: [{ aspect: 'clarity', indicator: 'Parent is unsatisfied and confused', intensity: 'high' }],
    objections: [{ objection: 'Fees', status: 'open' }],
    coveredPoints: [],
    missedPoints: [{ point: 'Fees' }, { point: 'Safety' }],
  });
  assert.equal(result.score, 34);
  assert.match(result.reasons.join(' '), /Concern/);
});

test('placeholder analysis does not invent a satisfaction score', () => {
  const result = calculateSessionSatisfaction({ isPlaceholder: true });
  assert.equal(result.score, null);
});
