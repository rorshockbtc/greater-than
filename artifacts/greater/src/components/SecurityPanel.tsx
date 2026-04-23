import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Lock, KeyRound, Smartphone, AlertOctagon } from 'lucide-react';

interface SecurityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityPanel({ isOpen, onClose }: SecurityPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="chat-widget">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-[400px] lg:w-[480px] bg-[hsl(var(--widget-bg))] border-l border-[hsl(var(--widget-border))] shadow-2xl z-[61] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3 text-red-400">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-[hsl(var(--widget-fg))]">Security Triage</h2>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8">
                <p className="text-sm text-gray-200">
                  <AlertOctagon className="w-4 h-4 inline-block mr-2 text-red-400 -mt-0.5" />
                  Your account may be at risk. Follow these steps immediately to secure your assets. Do not share your seed phrase with anyone.
                </p>
              </div>

              <div className="space-y-6">
                <Step 
                  number={1} 
                  icon={Lock} 
                  title="Freeze Account Operations" 
                  description="Temporarily halt all withdrawals and sensitive account changes."
                  action="Initiate Freeze"
                />
                
                <Step 
                  number={2} 
                  icon={KeyRound} 
                  title="Revoke Active Sessions" 
                  description="Log out of all devices currently connected to your account."
                  action="Revoke All"
                />
                
                <Step 
                  number={3} 
                  icon={Smartphone} 
                  title="Reset 2FA Authentication" 
                  description="Generate new backup codes and re-bind your authenticator app."
                  action="Reset 2FA"
                />
              </div>

              <div className="mt-10 pt-6 border-t border-white/10">
                <h3 className="text-sm font-semibold text-gray-200 mb-3">Still need help?</h3>
                <p className="text-sm text-gray-400 mb-4">
                  If you cannot access your account to perform these steps, escalate immediately to our security team.
                </p>
                <button className="w-full py-2.5 px-4 rounded-xl text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                  Emergency Human Escalation
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Step({ number, icon: Icon, title, description, action }: { number: number, icon: any, title: string, description: string, action: string }) {
  return (
    <div className="relative pl-10">
      <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-600/30">
        {number}
      </div>
      {number !== 3 && (
        <div className="absolute left-3 top-8 bottom-[-16px] w-px bg-white/10" />
      )}
      
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/15 transition-colors">
        <h3 className="text-base font-semibold text-gray-200 flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-gray-400" />
          {title}
        </h3>
        <p className="text-sm text-gray-400 mb-4">{description}</p>
        <button className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors">
          {action}
        </button>
      </div>
    </div>
  );
}
