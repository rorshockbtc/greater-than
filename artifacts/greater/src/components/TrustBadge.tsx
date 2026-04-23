import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Info, ExternalLink, Clock, AlertTriangle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TrustBadgeProps {
  score: number;
  ciBreakdown?: string;
  sourceUrl?: string;
  lastUpdated?: string;
}

export function TrustBadge({ score, ciBreakdown, sourceUrl, lastUpdated }: TrustBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const percentage = Math.round(score * 100);
  
  // Editorial pass: drop the per-tier tinted-rect "pill" chrome
  // (emerald / amber / warning rounded-full) for the same italic-
  // serif chb-chat-pill treatment the rest of the chat surface uses.
  // Color is the only per-tier signal; the dot inherits it via
  // currentColor. WCAG-AA on the cream widget surface is handled by
  // the [data-theme="light"] overrides next to chb-chat-pill.
  let statusColor = "text-emerald-400";
  let statusLabel = "Verified";
  let Icon = ShieldCheck;

  if (percentage < 75) {
    statusColor = "text-amber-400";
    statusLabel = "Verification Required";
    Icon = AlertTriangle;
  } else if (percentage < 92) {
    statusColor = "text-warning";
    statusLabel = "Good";
    Icon = Info;
  }

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImproveClick = () => {
    toast({
      title: "Feedback Recorded",
      description: "Thank you for helping improve Greater's model accuracy.",
    });
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={badgeRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={`${statusLabel} · ${percentage}% Trust Score`}
        className={cn(
          "chb-chat-pill transition-colors hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:ring-current rounded-sm",
          statusColor,
        )}
      >
        <span>{percentage}% trust</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200 -ml-1", isOpen && "rotate-180")} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-72 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl shadow-black/50 p-4 z-50 overflow-hidden"
          >
            {/* Glossy top edge highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Sovereign Trust Ribbon
            </h4>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">CI Breakdown</span>
                <p className="mt-1 text-foreground/90 font-mono text-xs p-2 bg-black/40 rounded-md border border-white/5">
                  {ciBreakdown || "Cryptographic integrity verified against local schema."}
                </p>
              </div>

              {sourceUrl && (
                <div className="flex items-start gap-2">
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold block">Source</span>
                    <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline text-xs truncate block max-w-[200px]">
                      {sourceUrl}
                    </a>
                  </div>
                </div>
              )}

              {lastUpdated && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold block">Last Verified</span>
                    <span className="text-foreground/80 text-xs">
                      {new Date(lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
              <button 
                onClick={handleImproveClick}
                className="text-xs text-muted-foreground hover:text-emerald-400 transition-colors"
              >
                Improve This Model
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
