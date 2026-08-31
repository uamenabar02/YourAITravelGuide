import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, CloudCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { TranslatedText } from "./TranslatedText";

export const SyncStatusBanner: React.FC = () => {
  const { syncUserDataWithCloud, syncStatus } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [isSyncingNow, setIsSyncingNow] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-flush queue on reconnect
      handleSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check localStorage pending queue
    try {
      const rawQueue = localStorage.getItem("localexplorer_offline_mutation_queue");
      if (rawQueue) {
        const queue = JSON.parse(rawQueue);
        if (Array.isArray(queue)) setPendingQueueCount(queue.length);
      }
    } catch {}

    const interval = setInterval(() => {
      setIsOnline(navigator.onLine);
      try {
        const rawQueue = localStorage.getItem("localexplorer_offline_mutation_queue");
        if (rawQueue) {
          const queue = JSON.parse(rawQueue);
          if (Array.isArray(queue)) setPendingQueueCount(queue.length);
        } else {
          setPendingQueueCount(0);
        }
      } catch {}
    }, 3000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    if (!navigator.onLine) return;
    setIsSyncingNow(true);
    try {
      // Process offline queue if any
      const rawQueue = localStorage.getItem("localexplorer_offline_mutation_queue");
      if (rawQueue) {
        localStorage.removeItem("localexplorer_offline_mutation_queue");
        setPendingQueueCount(0);
      }
      await syncUserDataWithCloud(true);
    } catch (err) {
      console.error("Manual sync error:", err);
    } finally {
      setTimeout(() => setIsSyncingNow(false), 800);
    }
  };

  if (isOnline && pendingQueueCount === 0 && syncStatus === "synced" && !isSyncingNow) {
    return null; // hide when everything is fully synced and online
  }

  return (
    <div className="bg-[#f5f5f0] border-b border-[#e5e5df] px-4 py-2 text-xs font-sans text-[#2c2c24] flex items-center justify-between no-print shadow-3xs">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between px-2 sm:px-4">
        <div className="flex items-center space-x-2.5">
          {!isOnline ? (
            <span className="flex items-center space-x-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
              <WifiOff className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
              <span className="font-semibold"><TranslatedText text="Offline Mode" /></span>
              <span className="text-amber-700 hidden sm:inline">— <TranslatedText text="changes saved locally & queued for cloud sync" /></span>
            </span>
          ) : pendingQueueCount > 0 || isSyncingNow ? (
            <span className="flex items-center space-x-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncingNow ? "animate-spin" : ""}`} />
              <span className="font-semibold"><TranslatedText text="Syncing Queue" /></span>
              <span>(<TranslatedText text={`${pendingQueueCount} pending changes syncing to cloud...`} />)</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 text-[#5A5A40] bg-[#ecece4] px-2.5 py-1 rounded-xl border border-[#d1d1ca]">
              <Wifi className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span><TranslatedText text="Back online — All edits synchronized with Firestore" /></span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {pendingQueueCount > 0 && (
            <span className="text-[11px] font-serif italic text-[#8a8a7e]">
              <TranslatedText text={`${pendingQueueCount} offline action${pendingQueueCount === 1 ? "" : "s"} buffered`} />
            </span>
          )}
          {isOnline && (
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncingNow}
              className="flex items-center space-x-1 px-3 py-1 bg-white hover:bg-[#ecece4] text-[#2c2c24] rounded-lg border border-[#d1d1ca] transition-colors cursor-pointer text-xs font-medium shadow-3xs"
            >
              <RefreshCw className={`w-3 h-3 text-[#5A5A40] ${isSyncingNow ? "animate-spin" : ""}`} />
              <span>{isSyncingNow ? <TranslatedText text="Syncing..." /> : <TranslatedText text="Sync Now" />}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
