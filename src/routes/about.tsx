import { createFileRoute } from "@tanstack/react-router";
import { AboutLanding } from "@/components/AboutLanding";

export const Route = createFileRoute("/about")({
  component: AboutLanding,
});
