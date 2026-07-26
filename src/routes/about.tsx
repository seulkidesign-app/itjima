import { createFileRoute } from "@tanstack/react-router";
import { AboutLandingRefined } from "@/components/AboutLandingRefined";

export const Route = createFileRoute("/about")({
  component: AboutLandingRefined,
});
