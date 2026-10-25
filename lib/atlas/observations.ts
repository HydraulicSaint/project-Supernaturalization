import type { Coordinate, WanderProfile } from './director';
import { eligible } from './director';
export type Observation = {
  id: string; source: 'atlas-demo'; category: 'environment'; center: Coordinate;
  uncertaintyM: number; occurredAt: string; observedAt: string; sourceTimestamp: string;
  confidence: number; provenance: string; priority: number; simulated: true; visibility: 'public';
};
export const simulatedEvents: Observation[] = [
  [-107.6225, 37.6218], [-107.5919, 37.6213], [-107.5959, 37.6274]
].map((center, i) => ({
  id: `simulated-${i + 1}`, source: 'atlas-demo', category: 'environment', center: center as Coordinate,
  uncertaintyM: 300, occurredAt: '2026-10-25T12:00:00Z', observedAt: '2026-10-25T12:05:00Z',
  sourceTimestamp: '2026-10-25T12:00:00Z', confidence: 0.5, provenance: 'Authored synthetic fixture; no real observation',
  priority: 1, simulated: true, visibility: 'public'
}));
// Explicit field projection: never spread an upstream record into a wallpaper payload.
export function publicEvents(events: Observation[], profile: WanderProfile, minConfidence = 0) {
  return events.filter(e => e.visibility === 'public' && e.simulated === true && e.source === 'atlas-demo' &&
    e.confidence >= minConfidence && eligible(profile, e.center)).map(e => ({
    id: e.id, source: e.source, category: e.category, center: e.center, uncertaintyM: e.uncertaintyM,
    occurredAt: e.occurredAt, observedAt: e.observedAt, sourceTimestamp: e.sourceTimestamp,
    confidence: e.confidence, provenance: e.provenance, priority: e.priority, simulated: e.simulated,
    visibility: e.visibility
  }));
}
