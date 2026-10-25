export type Coordinate = [number, number];
export type Bounds = [number, number, number, number];
export type WanderProfile = {
  version: 1; name: string; seed: number; bounds: Bounds; exclusions: Bounds[];
  pois: { name: string; center: Coordinate }[];
};
export const defaultProfile: WanderProfile = {
  version: 1, name: 'Needle Mountains', seed: 10,
  bounds: [-107.72, 37.55, -107.48, 37.72],
  exclusions: [[-107.72, 37.55, -107.69, 37.58]],
  pois: [
    { name: 'Mt. Eolus', center: [-107.6225, 37.6218] },
    { name: 'Windom Peak', center: [-107.5919, 37.6213] },
    { name: 'Sunlight Peak', center: [-107.5959, 37.6274] }
  ]
};
export function contains(b: Bounds, p: Coordinate) {
  return p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
}
export function eligible(p: WanderProfile, c: Coordinate) {
  return contains(p.bounds, c) && !p.exclusions.some(b => contains(b, c));
}
function validBounds(b: unknown): b is Bounds {
  return Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) &&
    b[0] >= -180 && b[2] <= 180 && b[1] >= -85 && b[3] <= 85 && b[0] < b[2] && b[1] < b[3];
}
export function validateProfile(value: unknown): value is WanderProfile {
  if (!value || typeof value !== 'object') return false;
  const p = value as WanderProfile;
  return p.version === 1 && typeof p.name === 'string' && p.name.length <= 100 &&
    Number.isSafeInteger(p.seed) && validBounds(p.bounds) && Array.isArray(p.exclusions) &&
    p.exclusions.length <= 20 && p.exclusions.every(validBounds) && Array.isArray(p.pois) &&
    p.pois.length > 0 && p.pois.length <= 100 && p.pois.every(x =>
      x && typeof x.name === 'string' && Array.isArray(x.center) && x.center.length === 2 &&
      x.center.every(Number.isFinite) && eligible(p, x.center));
}
export function selectPoi(p: WanderProfile, visit: number) {
  const allowed = p.pois.filter(x => eligible(p, x.center));
  if (!allowed.length) throw new Error('No eligible viewpoints');
  return allowed[((p.seed % allowed.length + visit) % allowed.length + allowed.length) % allowed.length];
}
export const phases = ['OVERVIEW', 'ACQUIRE', 'DESCENT_1', 'HOLD', 'DESCENT_2', 'INSPECT', 'WITHDRAW'] as const;
export type Phase = typeof phases[number];
export type Director = { phase: Phase; visit: number };
export function advance(s: Director): Director {
  const index = phases.indexOf(s.phase);
  return { phase: phases[(index + 1) % phases.length], visit: s.visit + (s.phase === 'WITHDRAW' ? 1 : 0) };
}
export function frame(s: Director, profile: WanderProfile) {
  const i = phases.indexOf(s.phase);
  return {
    center: selectPoi(profile, s.visit).center,
    zoom: [10, 10.8, 12, 12, 13.2, 13.2, 10][i],
    pitch: [15, 20, 35, 35, 55, 55, 15][i],
    bearing: [0, 0, 15, 15, 30, 65, 0][i],
    duration: [8000, 4000, 7000, 3000, 7000, 12000, 8000][i]
  };
}
