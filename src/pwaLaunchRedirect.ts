/*
 * iOS Home Screen web clips can relaunch the exact Safari URL that was used
 * when the shortcut was created, even when the web app manifest declares
 * start_url: /app. Keep the public root as the SEO/marketing landing in a
 * normal browser, but route standalone launches of / straight into the app.
 */

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function isStandaloneLaunch() {
  if (typeof window === "undefined") return false;

  const displayModeStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    (window.navigator as NavigatorWithStandalone).standalone === true;

  return displayModeStandalone || iosStandalone;
}

if (
  typeof window !== "undefined" &&
  window.location.pathname === "/" &&
  isStandaloneLaunch()
) {
  const destination = `/app${window.location.search}${window.location.hash}`;
  window.location.replace(destination);
}
