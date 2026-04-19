import { useEffect, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useLLM } from "@/llm/LLMProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * OpenClaw mode settings dialog.
 *
 * Lets the visitor wire any OpenAI-compatible HTTP endpoint
 * (Ollama, llama.cpp, LM Studio, vLLM, …) into Greater as the
 * inference backend. The settings persist to `localStorage` and the
 * "Test connection" button verifies the endpoint before flipping the
 * master toggle into the "active" state in `LLMProvider`.
 */
export function OpenClawPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const llm = useLLM();
  const cfg = llm.openClawConfig;

  // Local mirror state so typing in the inputs feels snappy and
  // doesn't push the global config (and reset health) on every key.
  const [baseUrl, setBaseUrl] = useState(cfg.baseUrl);
  const [model, setModel] = useState(cfg.model);
  const [apiKey, setApiKey] = useState(cfg.apiKey);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBaseUrl(cfg.baseUrl);
      setModel(cfg.model);
      setApiKey(cfg.apiKey);
    }
    // We deliberately depend on `isOpen` only — re-syncing on every
    // cfg change would clobber in-flight edits when the user is
    // typing in the inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const dirty =
    baseUrl !== cfg.baseUrl || model !== cfg.model || apiKey !== cfg.apiKey;

  const saveDraft = () => {
    if (!dirty) return;
    llm.setOpenClawConfig({ baseUrl, model, apiKey });
  };

  const handleTest = async () => {
    // Persist any in-flight edits before pinging — the user's intent
    // is "test what I just typed", not "test the previous values".
    if (dirty) llm.setOpenClawConfig({ baseUrl, model, apiKey });
    await llm.testOpenClawConnection();
  };

  const handleToggle = (enabled: boolean) => {
    if (dirty) llm.setOpenClawConfig({ baseUrl, model, apiKey, enabled });
    else llm.setOpenClawConfig({ enabled });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-[hsl(var(--widget-bg))] border-[hsl(var(--widget-border))] text-[hsl(var(--widget-fg))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-violet-400" />
            OpenClaw mode &mdash; bring your own local LLM
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--widget-muted))]">
            Point Greater at any OpenAI-compatible HTTP endpoint
            (Ollama, llama.cpp, LM Studio, vLLM, &hellip;) to use your
            own model for chat. When enabled, Greater stops calling
            its cloud fallback &mdash; you are paying your own compute.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-white/[0.03] border border-[hsl(var(--widget-border))] rounded-md p-3">
            <div className="flex-1">
              <p className="text-sm font-medium">
                Use my local model
              </p>
              <p className="text-[11px] text-[hsl(var(--widget-muted))]">
                {cfg.enabled
                  ? llm.openClawHealth.state === "ok"
                    ? "Active. All chat answers route to your endpoint."
                    : "Enabled, but the connection has not been verified — test it below."
                  : "Disabled. Greater uses its in-browser model and cloud fallback."}
              </p>
            </div>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={handleToggle}
              data-testid="openclaw-toggle"
            />
          </div>

          <Field label="Base URL" hint="e.g. http://localhost:11434/v1">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              onBlur={saveDraft}
              placeholder="http://localhost:11434/v1"
              className="bg-transparent border-[hsl(var(--widget-border))] text-sm font-mono"
              data-testid="openclaw-baseurl"
            />
          </Field>

          <Field label="Model" hint="e.g. llama3.2:1b">
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onBlur={saveDraft}
              placeholder="llama3.2:1b"
              className="bg-transparent border-[hsl(var(--widget-border))] text-sm font-mono"
              data-testid="openclaw-model"
            />
          </Field>

          <Field label="API key" hint="optional; sent as Bearer token">
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={saveDraft}
                placeholder="(leave blank for no auth)"
                className="bg-transparent border-[hsl(var(--widget-border))] text-sm font-mono"
                data-testid="openclaw-apikey"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowKey((v) => !v)}
                className="text-[hsl(var(--widget-muted))]"
              >
                {showKey ? "Hide" : "Show"}
              </Button>
            </div>
          </Field>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => void handleTest()}
              disabled={llm.openClawHealth.state === "testing" || !baseUrl.trim()}
              className="bg-violet-600 hover:bg-violet-500 text-white"
              data-testid="openclaw-test"
            >
              {llm.openClawHealth.state === "testing" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                  Testing…
                </>
              ) : (
                "Test connection"
              )}
            </Button>
            <HealthBadge state={llm.openClawHealth.state} />
          </div>

          {llm.openClawHealth.state === "ok" && (
            <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
              Connected.{" "}
              {llm.openClawHealth.models?.length ? (
                <>
                  Endpoint reports{" "}
                  <span className="font-mono">{llm.openClawHealth.models.length}</span>{" "}
                  model{llm.openClawHealth.models.length === 1 ? "" : "s"}
                  {llm.openClawHealth.models.length <= 8 && (
                    <>
                      :{" "}
                      <span className="font-mono">
                        {llm.openClawHealth.models.join(", ")}
                      </span>
                    </>
                  )}
                  .
                </>
              ) : (
                <>Models endpoint returned no entries — that is OK for some servers.</>
              )}
            </div>
          )}

          {llm.openClawHealth.state === "error" && llm.openClawHealth.message && (
            <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded p-2 break-words">
              {llm.openClawHealth.message}
            </div>
          )}

          <div className="text-[11px] text-[hsl(var(--widget-muted))] bg-white/[0.03] border border-[hsl(var(--widget-border))] rounded-md p-3 space-y-1">
            <p className="font-medium text-[hsl(var(--widget-fg))]">
              Quickstart with Ollama
            </p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>
                Install <span className="font-mono">ollama</span> and run{" "}
                <span className="font-mono">ollama pull llama3.2:1b</span>.
              </li>
              <li>
                Start the server with CORS enabled:{" "}
                <span className="font-mono">
                  OLLAMA_ORIGINS=&quot;*&quot; ollama serve
                </span>
              </li>
              <li>Paste the URL above and click Test connection.</li>
            </ol>
            <p className="pt-1">
              <a
                href="/openclaw"
                className="inline-flex items-center gap-1 text-violet-300 hover:underline"
              >
                Read the OpenClaw vision <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1 text-[hsl(var(--widget-muted))] hover:text-[hsl(var(--widget-fg))]"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between">
        <span className="text-xs font-medium text-[hsl(var(--widget-fg))]">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-[hsl(var(--widget-muted))]">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function HealthBadge({
  state,
}: {
  state: "idle" | "testing" | "ok" | "error";
}) {
  if (state === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
        <CircleCheck className="w-3.5 h-3.5" />
        Connected
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-red-300">
        <CircleAlert className="w-3.5 h-3.5" />
        Failed
      </span>
    );
  }
  if (state === "testing") return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[hsl(var(--widget-muted))]">
      Not yet tested
    </span>
  );
}
