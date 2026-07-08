"use client";

// In-house pageview tracker — no third-party pixel/SDK. Fires a beacon to the backend
// on every route change; see backend/src/api/server.ts POST /api/track and the admin
// dashboard's Analytics "Web Traffic" section.
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function getVisitorId(): string {
  const KEY = "eb_vid";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private browsing etc.) — fall back to a per-load id
    return crypto.randomUUID();
  }
}

function TrackPageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;

    try {
      const payload = JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        utmSource: searchParams.get("utm_source"),
        utmMedium: searchParams.get("utm_medium"),
        utmCampaign: searchParams.get("utm_campaign"),
        visitorId: getVisitorId(),
      });
      const url = `${apiUrl}/api/track`;

      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
      }
    } catch {
      // A tracking failure must never affect the page itself.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams.toString()]);

  return null;
}

export default function TrackPageView() {
  return (
    <Suspense fallback={null}>
      <TrackPageViewInner />
    </Suspense>
  );
}
