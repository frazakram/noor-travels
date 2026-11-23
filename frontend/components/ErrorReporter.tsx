"use client";

import { useEffect } from "react";
import { flushReports, reportError, setReportContext, type ReportKind } from "@/lib/error-reporter";
import { isNativeApp, nativeAppVersion, nativeTakeCrashReports } from "@/lib/native-bridge";

/** Installs error reporting once for the whole app (see lib/error-reporter.ts). Renders nothing. */
export function ErrorReporter() {
  useEffect(() => {
    if (isNativeApp()) setReportContext({ platform: "apk", app_version: nativeAppVersion() || undefined });

    const onError = (e: ErrorEvent) => reportError("error", e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportError("unhandledrejection", e.reason);
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushReports();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flushReports);

    // Crashes the APK saved before Android closed it (APK 1.10+); sent once, then deleted there.
    for (const crash of nativeTakeCrashReports()) {
      const kind: ReportKind = crash.kind === "renderer_gone" ? "renderer_gone" : "native_crash";
      reportError(kind, crash.message, {
        stack: crash.stack || undefined,
        platform: "native",
        app_version: crash.app_version,
        path: crash.path || undefined,
      });
    }

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flushReports);
    };
  }, []);
  return null;
}
