import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { recoverAuthSession } from "./lib/oauth";
import { queryClient, router } from "./router";
import "./styles.css";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function Bootstrap() {
  useEffect(() => {
    recoverAuthSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
