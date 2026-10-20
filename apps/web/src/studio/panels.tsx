import { Badge } from "@fluentui/react-components";
import {
  BrainCircuitRegular, ClockRegular, CubeRegular, DataTrendingRegular, HourglassRegular, PeopleCommunityRegular, SlideLayoutRegular,
  SportSoccerRegular, TrophyRegular, VideoPersonRegular,
} from "@fluentui/react-icons";
import type { ReactElement } from "react";
import type { Scene } from "../contracts";

const TEMPLATE_ICONS: Record<string, ReactElement> = {
  "Starting soon": <ClockRegular />, "Live match": <SportSoccerRegular />, "Analyst desk": <DataTrendingRegular />,
  Break: <HourglassRegular />, "Full-time": <TrophyRegular />, Interview: <VideoPersonRegular />,
  "Match intelligence": <BrainCircuitRegular />, "Fan zone": <PeopleCommunityRegular />, "3D pitch": <CubeRegular />,
};

export const sceneIcon = (scene: Scene) => TEMPLATE_ICONS[scene.template ?? ""] ?? <SlideLayoutRegular />;

/** The one commentary every scene carries. */
export function ModeBadge() {
  return (
    <Badge size="small" appearance="outline" color="brand">Commentary</Badge>
  );
}
