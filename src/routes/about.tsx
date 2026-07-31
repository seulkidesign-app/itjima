import { createFileRoute } from "@tanstack/react-router";
import { UsLaunchLanding } from "@/components/UsLaunchLanding";

export const Route = createFileRoute("/about")({
  component: UsLaunchLanding,
});
