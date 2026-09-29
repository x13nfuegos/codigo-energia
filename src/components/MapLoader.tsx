"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "@/lib/types";

const EnergyMap = dynamic(() => import("./EnergyMap"), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-xl border border-line bg-surface" />,
});

export function MapLoader(props: { points: MapPoint[]; height?: number }) {
  return <EnergyMap {...props} />;
}
