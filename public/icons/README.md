# PWA icon cache note

The iOS Home Screen install flow caches `apple-touch-icon` aggressively. Install metadata currently points to the versioned `/icons/icon-192.png?v=20260818-2` URL so Safari is forced to re-request the yellow Itjima wordmark icon instead of reusing an older blank preview.
