import { createFileRoute } from "@tanstack/react-router";
import { Route as LegacyHomeRoute } from "./index";

const HomeComponent = LegacyHomeRoute.options.component;

if (!HomeComponent) {
  throw new Error("Itjima home route component is unavailable");
}

export const Route = createFileRoute("/app")({
  component: HomeComponent,
});
