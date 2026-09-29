"use client";

import dynamic from "next/dynamic";
import type { EnergyMapProps } from "@/lib/map-types";

const EnergyMap = dynamic(() => import("./EnergyMap"), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-xl border border-line bg-surface" />,
});

export function MapLoader(props: EnergyMapProps) {
  return <EnergyMap {...props} />;
}
