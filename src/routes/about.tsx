import { createFileRoute } from "@tanstack/react-router";
import { UsLaunchLanding } from "@/components/UsLaunchLanding";

export const Route = createFileRoute("/about")({
  component: AboutRoute,
});

function AboutRoute() {
  return (
    <div className="itjima-launch-page">
      <UsLaunchLanding />
    </div>
  );
}
