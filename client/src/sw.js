/* Service worker (Workbox, injectManifest).
   Caches ONLY the public app shell (JS, CSS, fonts, icons, HTML).
   Guest data, tokens, API and Supabase responses are never stored: they always go to the network. */
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

clientsClaim();
cleanupOutdatedCaches(); // removes caches from older app versions
precacheAndRoute(self.__WB_MANIFEST);

// Page loads (including /i/:token and /usher/scan) get the cached app shell, so the interface opens offline
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// The API, Supabase and any other cross-origin request: network only, never cached
registerRoute(
  ({ url }) => url.origin !== self.location.origin || url.pathname.startsWith("/api/"),
  new NetworkOnly()
);

// Last resort for page loads that cannot be served
setCatchHandler(async ({ request }) =>
  request.destination === "document" ? (await matchPrecache("/offline.html")) || Response.error() : Response.error()
);

// The update prompt asks the waiting worker to take over only when the user taps Update
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
