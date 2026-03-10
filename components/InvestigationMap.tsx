"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer } from "@deck.gl/layers";
import { LocationEvent } from "@/lib/types";

export function InvestigationMap({ events, visibleEvents }: { events: LocationEvent[]; visibleEvents: number }) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const layerData = useMemo(() => events.slice(0, visibleEvents), [events, visibleEvents]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [-124.01, 41.22],
      zoom: 10
    });

    const overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    map.addControl(overlay);

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      map.removeControl(overlay);
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    overlayRef.current?.setProps({
      layers: [
        new ScatterplotLayer<LocationEvent>({
          id: "events",
          data: layerData,
          getPosition: (d) => d.geom,
          getRadius: 180,
          getFillColor: (d) => (d.eventType === "last_seen" ? [255, 107, 53, 220] : [71, 189, 255, 220]),
          pickable: true
        })
      ]
    });
  }, [layerData]);

  return <div ref={containerRef} style={{ height: "100vh", width: "100%" }} />;
}
