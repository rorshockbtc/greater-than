import React, { useEffect, useState } from "react";
import { Info, Trash2, ArrowUpCircle, AlertTriangle } from "lucide-react";
import { useLLM } from "./LLMProvider";

/**
 * Heuristic mobile detection. We deliberately avoid a hard
 * useragent-based block — many tablets and large phones are happy
 * to download a 250 MB model — but we DO surface a louder warning
 * to anyone whose viewport reads as small. The check is window-
 * gated so it stays SSR-safe; defaults to "not mobile" on the
 * server.
 */
function useIsLikelyMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return isMobile;
}

/**
 * Small (i) popover surfacing the active model metadata and a
 * "Clear cache & re-download" action. Mounted in the chat widget
 * header.
 */
export function ModelInfoPopover() {
  const { modelInfo, status, clearCacheAndReload, loadDeepModel } = useLLM();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmingUpgrade, setConfirmingUpgrade] = useState(false);
  const isMobile = useIsLikelyMobile();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))] transition-colors"
        title="Model info"
        aria-label="Model info"
        data-testid="button-model-info"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 z-50 rounded-lg border border-[hsl(var(--widget-border))] bg-[hsl(var(--widget-card))] p-3 text-xs text-[hsl(var(--widget-fg))] shadow-2xl"
          role="dialog"
        >
          <div className="font-semibold mb-2 text-sm">Local model</div>
          <dl className="space-y-1.5">
            <Row label="Model" value={modelInfo.llmName} mono />
            <Row label="Quantization" value={modelInfo.llmQuantization} mono />
            <Row label="Embedder" value={modelInfo.embedderName} mono />
            <Row label="Approx. size" value={`${modelInfo.approxSizeMb} MB`} />
            <Row
              label="Loaded at"
              value={
                modelInfo.loadedAt
                  ? modelInfo.loadedAt.toLocaleString()
                  : status === "ready"
                    ? "—"
                    : "Not yet loaded"
              }
            />
          </dl>
          {modelInfo.deepModelAvailable && !modelInfo.isDeepModel && (
            <div className="mt-3 pt-3 border-t border-[hsl(var(--widget-border))]">
              {!confirmingUpgrade ? (
                <button
                  type="button"
                  onClick={() => setConfirmingUpgrade(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--widget-fg))] hover:text-[hsl(328_99%_58%)]"
                  data-testid="button-upgrade-model"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  Load deeper model (~{modelInfo.deepModelSizeMb} MB)
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-[hsl(var(--widget-muted))] leading-relaxed">
                    One-time download of about {modelInfo.deepModelSizeMb} MB.
                    Replaces the current model in this tab. The default
                    {" "}
                    {modelInfo.approxSizeMb} MB model keeps the bot light
                    on mobile data; the deeper model produces sharper
                    synthesis on harder questions.
                  </p>
                  {isMobile && (
                    <p
                      className="flex items-start gap-1.5 text-[11px] text-amber-300/90 leading-relaxed"
                      data-testid="upgrade-mobile-warning"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>
                        You appear to be on a mobile device — this download
                        will use roughly {modelInfo.deepModelSizeMb} MB of
                        data. Wi-Fi recommended.
                      </span>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        loadDeepModel();
                        setConfirmingUpgrade(false);
                      }}
                      className="px-2 py-1 text-[11px] rounded bg-[hsl(328_99%_58%)] text-white hover:bg-[hsl(328_99%_50%)]"
                      data-testid="button-upgrade-model-confirm"
                    >
                      Download &amp; swap
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingUpgrade(false)}
                      className="px-2 py-1 text-[11px] rounded border border-[hsl(var(--widget-border))]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-[hsl(var(--widget-border))]">
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"
                data-testid="button-clear-cache"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear cache &amp; re-download
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-[hsl(var(--widget-muted))] leading-relaxed">
                  This wipes the model cache and the local vector index,
                  then reloads the page.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => clearCacheAndReload()}
                    className="px-2 py-1 text-[11px] rounded bg-red-600 text-white hover:bg-red-500"
                    data-testid="button-clear-cache-confirm"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="px-2 py-1 text-[11px] rounded border border-[hsl(var(--widget-border))]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-[hsl(var(--widget-muted))]">{label}</dt>
      <dd
        className={
          mono
            ? "font-mono text-[10px] text-right break-all"
            : "text-right"
        }
      >
        {value}
      </dd>
    </div>
  );
}
