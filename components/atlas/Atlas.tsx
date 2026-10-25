'use client';
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { advance, defaultProfile, frame, selectPoi, validateProfile } from '@/lib/atlas/director';
import type { Director } from '@/lib/atlas/director';
import { publicEvents, simulatedEvents } from '@/lib/atlas/observations';
import styles from './atlas.module.css';

export default function Atlas() {
  const container = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mode, setMode] = useState('Ambient');
  const [profile, setProfile] = useState(defaultProfile);
  const [director, setDirector] = useState<Director>({ phase: 'OVERVIEW', visit: 0 });
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(true);
  const [terrain, setTerrain] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Offline schematic · no elevation loaded');
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [reduced, setReduced] = useState(true);
  const events = publicEvents(simulatedEvents, profile);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => { setReduced(media.matches); if (media.matches) setPlaying(false); };
    motion(); media.addEventListener('change', motion);
    const visibility = () => setActive(!document.hidden && document.hasFocus());
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', visibility); window.addEventListener('focus', visibility);
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('atlas-profile-v1') || 'null');
      if (validateProfile(saved)) setProfile(saved);
    } catch { /* Corrupt or inaccessible preferences use safe defaults. */ }
    return () => {
      media.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', visibility); window.removeEventListener('focus', visibility);
    };
  }, []);

  useEffect(() => {
    if (!container.current) return;
    setReady(false);
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current, center: defaultProfile.pois[0].center, zoom: 10, maxZoom: 14,
        maxTileCacheSize: 128, attributionControl: { compact: true },
        style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0c1b23' } }] }
      });
    } catch {
      setStatus('WebGL unavailable · use the simulated event list in Analysis'); return;
    }
    map.current = instance;
    instance.on('load', () => {
      if (terrain) {
        instance.addSource('dem', { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 14, attribution: 'Terrain Tiles © Mapzen / AWS Open Data · multiple elevation sources' });
        instance.addLayer({ id: 'relief', type: 'hillshade', source: 'dem', paint: { 'hillshade-shadow-color': '#142b33', 'hillshade-highlight-color': '#9ba99a', 'hillshade-exaggeration': 0.6 } });
        instance.setTerrain({ source: 'dem', exaggeration: 1 });
        setStatus('Terrain requested · availability depends on network and tile coverage');
      } else setStatus('Offline schematic · no elevation loaded');
      instance.addSource('events', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      instance.addLayer({ id: 'uncertainty', type: 'circle', source: 'events', paint: { 'circle-radius': 18, 'circle-color': '#dda759', 'circle-opacity': 0.12, 'circle-stroke-color': '#dda759', 'circle-stroke-width': 1 } });
      instance.addLayer({ id: 'events', type: 'circle', source: 'events', paint: { 'circle-radius': 4, 'circle-color': '#dda759' } });
      setReady(true);
    });
    instance.on('error', () => setStatus('Terrain/network unavailable · schematic and simulated data remain usable'));
    instance.on('webglcontextlost', () => { setPlaying(false); setStatus('Graphics context lost · reload renderer to recover'); });
    const manual = (e: { originalEvent?: unknown }) => { if (e.originalEvent) setPlaying(false); };
    instance.on('dragstart', manual); instance.on('zoomstart', manual); instance.on('rotatestart', manual);
    return () => { instance.remove(); map.current = null; };
  }, [terrain]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    instance.setMaxBounds([[profile.bounds[0], profile.bounds[1]], [profile.bounds[2], profile.bounds[3]]]);
    const source = instance.getSource('events') as maplibregl.GeoJSONSource;
    source.setData({ type: 'FeatureCollection', features: events.map(e => ({ type: 'Feature', properties: { id: e.id }, geometry: { type: 'Point', coordinates: e.center } })) });
    for (const layer of ['events', 'uncertainty']) instance.setLayoutProperty(layer, 'visibility', mode === 'Ambient' ? 'none' : 'visible');
    // Presentation changes affect layers and controls only, never the camera.
    instance.dragPan.disable();
    if (mode === 'Analysis') instance.dragPan.enable();
    for (const handler of [instance.scrollZoom, instance.boxZoom, instance.dragRotate, instance.keyboard, instance.doubleClickZoom, instance.touchZoomRotate]) {
      if (mode === 'Analysis') handler.enable(); else handler.disable();
    }
  }, [ready, mode, profile]);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !playing || !active || reduced) { instance?.stop(); return; }
    const target = frame(director, profile);
    instance.easeTo({ ...target, easing: t => t * t * (3 - 2 * t) });
    const timer = window.setTimeout(() => setDirector(advance), target.duration + 1200);
    return () => { clearTimeout(timer); instance.stop(); };
  }, [director, profile, playing, active, reduced, ready]);

  function save() {
    try {
      const value: unknown = JSON.parse(draft);
      if (!validateProfile(value)) throw new Error('Invalid profile: check bounds, exclusions, and eligible POIs.');
      setProfile(value); setDirector({ phase: 'OVERVIEW', visit: 0 });
      try { localStorage.setItem('atlas-profile-v1', JSON.stringify(value)); setMessage('Profile saved on this device.'); }
      catch { setMessage('Profile applied for this session; local storage is unavailable.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Invalid profile'); }
  }

  return <div ref={shell} className={styles.shell}>
    <div ref={container} className={styles.map} aria-label="Needle Mountains geographic observer" />
    <header className={styles.header}><div><small>ARGUS / OBSERVATION SYSTEM</small><h1>ATLAS</h1><p>{selectPoi(profile, director.visit).name} · {director.phase.replaceAll('_', ' ')}</p></div>
      <label>Presentation<select value={mode} onChange={e => setMode(e.target.value)}>{['Ambient', 'Survey', 'Analysis'].map(x => <option key={x}>{x}</option>)}</select></label>
    </header>
    {mode !== 'Ambient' && <aside className={styles.panel}><h2>{profile.name}</h2><p>SIMULATED · {events.length} environmental fixtures</p><p>Amber halos indicate approximate locations (300 m uncertainty in fixtures; screen halo is symbolic).</p>
      {mode === 'Analysis' && <><p>Drag/zoom to take manual control. Resume with Play.</p>{events.map(e => <details key={e.id}><summary>{e.id} · SIMULATED</summary><p>{e.provenance}</p><p>Occurred: {e.occurredAt}<br />Observed: {e.observedAt}<br />Source timestamp: {e.sourceTimestamp}<br />Confidence: {e.confidence} · uncertainty: {e.uncertaintyM} m</p><p>Static fixture, never live. Age: {Math.max(0, Math.floor((Date.now() - Date.parse(e.observedAt)) / 3600000))} hours.</p></details>)}
        <label>Local wander profile (JSON)<textarea rows={9} value={draft} placeholder="Edit bounds, exclusions, seed and POIs" onChange={e => setDraft(e.target.value)} /></label>
        <button onClick={() => setDraft(JSON.stringify(profile, null, 2))}>Edit current profile</button> <button onClick={save}>Apply & save</button><p role="status">{message}</p>
      </>}
    </aside>}
    <footer className={styles.footer}><div className={styles.controls}>
      <button disabled={reduced} onClick={() => setPlaying(x => !x)}>{playing ? 'Pause' : 'Play'}</button>
      <button onClick={() => { setDirector(s => ({ phase: 'ACQUIRE', visit: s.visit + 1 })); }}>Next POI</button>
      <button onClick={() => { setDirector(s => ({ ...s, phase: 'OVERVIEW' })); map.current?.easeTo({ ...frame({ ...director, phase: 'OVERVIEW' }, profile), duration: reduced ? 0 : 1500 }); }}>Overview</button>
      <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => setMessage('Fullscreen exit unavailable')); else shell.current?.requestFullscreen?.().catch(() => setMessage('Fullscreen unavailable')); }}>Fullscreen</button>
    </div><p role="status">{status}{reduced ? ' · Reduced motion: automatic movement disabled' : ''}{!active ? ' · Paused while hidden/unfocused' : ''}</p>
      <details><summary>Info / Attributions / Terrain</summary><p>All observations are synthetic. No case data, geolocation, or scanner requests. Profiles stay in local browser storage. Default is a blank geographic schematic, not real terrain.</p>
        <p>Enable terrain to request public elevation tiles from AWS. This sends viewport tile requests to that provider. Mapzen Terrain Tiles combine multiple sources; see <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">source attribution and licensing</a>. MapLibre GL JS uses BSD-3-Clause. Terrain is not bundled for offline use.</p>
        <label><input type="checkbox" checked={terrain} onChange={e => { setPlaying(false); setTerrain(e.target.checked); }} /> Enable network terrain / reload renderer</label><p>{message}</p>
      </details>
    </footer>
  </div>;
}
