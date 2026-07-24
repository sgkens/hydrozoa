import React, { useEffect, useState, Component, ReactNode } from 'react';
import Chart from 'react-apexcharts';
import { 
  Activity, 
  Database, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Plus, 
  Github, 
  Gitlab, 
  Terminal,
  ChevronRight,
  Layers,
  Settings,
  History,
  CheckCircle2,
  Circle,
  ChevronDown,
  Menu,
  X,
  Search,
  Box,
  LogOut,
  Flag,
  Tag,
  Book,
  Copy,
  Check,
  Info,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types ---
interface Namespace {
  id: string;
  name: string;
  type: string;
  repo_count: number;
}
interface Repository {
  id: string;
  name: string;
  description: string;
  visibility: 'public' | 'private' | 'internal';
  web_url?: string;
}
interface Provider {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  token: string;
  isSource?: boolean;
}

interface SyncTarget {
  provider_id: string;
  status: 'synced' | 'syncing' | 'error' | 'pending';
  last_sync: string;
  bytes_transferred?: string;
  progress?: number;
}

interface SyncMatrixItem {
  id: string;
  source_repo: string;
  source_provider: string;
  branch?: string;
  last_commit?: string;
  sync_interval?: number;
  last_sync_duration?: string;
  success_rate?: number;
  targets: SyncTarget[];
  entities?: string[];
}

interface DLQItem {
  id: string;
  repository_id: string;
  target_provider: string;
  entity_type: string;
  failure_reason: string;
  last_attempt: string;
}

interface Log {
  timestamp: string;
  level: string;
  ui_message: string;
  technical_context: string;
  resolution?: string;
}

interface SystemStats {
  memory: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
  };
  uptime: string;
  cpu: {
    user: string;
    system: string;
  };
  platform: string;
  nodeVersion: string;
  arch: string;
}

interface ProviderInfo {
  name: string;
  apiVersion: string;
  status: string;
}

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

// --- Components ---

const ToastContainer = ({ toasts, onRemove }: { toasts: Toast[], onRemove: (id: string) => void }) => (
  <div className="fixed bottom-6 right-6 z-[9999] space-y-3 pointer-events-none">
    <AnimatePresence>
      {toasts.map((toast) => (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className={cn(
            "pointer-events-auto flex items-start gap-4 p-4 rounded-2xl glass-card border min-w-[320px] max-w-[400px] shadow-2xl",
            toast.type === 'success' ? "border-emerald-500/30 bg-emerald-500/5" :
            toast.type === 'error' ? "border-red-500/30 bg-red-500/5" :
            toast.type === 'warning' ? "border-amber-500/30 bg-amber-500/5" :
            "border-cyan-500/30 bg-cyan-500/5"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl",
            toast.type === 'success' ? "bg-emerald-500/20 text-emerald-400" :
            toast.type === 'error' ? "bg-red-500/20 text-red-400" :
            toast.type === 'warning' ? "bg-amber-500/20 text-amber-400" :
            "bg-cyan-500/20 text-cyan-400"
          )}>
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
             toast.type === 'error' ? <XCircle className="w-5 h-5" /> :
             toast.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
             <Info className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-white uppercase tracking-tighter">{toast.title}</h4>
            <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">{toast.message}</p>
          </div>
          <button 
            onClick={() => onRemove(toast.id)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

const HydrozoaLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center", className)}>
    <motion.div
      animate={{ 
        scale: [1, 1.1, 1],
        rotate: [0, 5, -5, 0]
      }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-magenta-500/20 blur-xl rounded-full"
    />
    <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f3ff" />
          <stop offset="100%" stopColor="#ff00ff" />
        </linearGradient>
      </defs>
      {/* Stylized Jellyfish/Hydrozoa Body */}
      <path 
        d="M 50 20 C 30 20 15 35 15 55 C 15 65 25 70 50 70 C 75 70 85 65 85 55 C 85 35 70 20 50 20 Z" 
        fill="url(#logoGrad)" 
        opacity="0.9"
      />
      {/* Tentacles */}
      {[...Array(5)].map((_, i) => (
        <motion.path
          key={i}
          d={`M ${30 + i * 10} 70 Q ${25 + i * 10} ${85 + (i % 2) * 5} ${30 + i * 10} 95`}
          fill="none"
          stroke="url(#logoGrad)"
          strokeWidth="3"
          strokeLinecap="round"
          animate={{ 
            d: [
              `M ${30 + i * 10} 70 Q ${25 + i * 10} ${85 + (i % 2) * 5} ${30 + i * 10} 95`,
              `M ${30 + i * 10} 70 Q ${35 + i * 10} ${85 - (i % 2) * 5} ${30 + i * 10} 95`,
              `M ${30 + i * 10} 70 Q ${25 + i * 10} ${85 + (i % 2) * 5} ${30 + i * 10} 95`
            ]
          }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {/* Core Glow */}
      <circle cx="50" cy="45" r="8" fill="white" opacity="0.3" />
    </svg>
  </div>
);

const SyncTentacles = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
      <div className="absolute inset-0 bg-[#0a0f1a] radial-glow" />
      <svg className="w-full h-full">
        <defs>
          <linearGradient id="tentacleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00f3ff" />
            <stop offset="100%" stopColor="#ff00ff" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {[...Array(8)].map((_, i) => (
          <motion.path
            key={i}
            d={`M ${-200 + i * 100} ${100 + i * 150} Q ${600 + i * 100} ${50 + i * 100} ${1400} ${400 + i * 100}`}
            fill="none"
            stroke="url(#tentacleGradient)"
            strokeWidth="1"
            filter="url(#glow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: [0, 1, 0.8],
              opacity: [0, 0.3, 0.05],
              strokeDashoffset: [0, -400]
            }}
            transition={{ 
              duration: 15 + i * 3, 
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 2
            }}
            style={{ strokeDasharray: "20 40" }}
          />
        ))}
      </svg>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, delay }: { title: string, value: string | number, icon: any, color: string, delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="glass-card p-6 border-white/5 group hover:border-cyan-500/30 transition-all relative overflow-hidden"
  >
    <div className={cn("absolute top-0 right-0 w-24 h-24 blur-3xl -mr-12 -mt-12 opacity-10 group-hover:opacity-20 transition-opacity", color)} />
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className={cn("p-3 rounded-xl bg-white/5 border border-white/5 group-hover:scale-110 transition-transform", color.replace('bg-', 'text-'))}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</span>
        <span className="text-2xl font-black text-white tracking-tighter mt-1">{value}</span>
      </div>
    </div>
    <div className="flex items-center gap-2 relative z-10">
      <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
      <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Real-time Telemetry</span>
    </div>
  </motion.div>
);

const ReactionButton = ({ 
  children, 
  onClick, 
  isLoading, 
  className, 
  disabled, 
  variant = 'primary',
  icon: Icon,
  type = 'button'
}: { 
  children?: React.ReactNode, 
  onClick?: (e?: any) => void, 
  isLoading?: boolean, 
  className?: string, 
  disabled?: boolean,
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger',
  icon?: any,
  type?: 'button' | 'submit' | 'reset'
}) => {
  const variants = {
    primary: "bg-cyan-500 text-white hover:bg-cyan-400 glow-cyan",
    secondary: "bg-magenta-500 text-white hover:bg-magenta-400 glow-magenta",
    ghost: "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10",
    danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        "relative flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 overflow-hidden group",
        variants[variant],
        className
      )}
    >
      {isLoading && (
        <motion.div 
          className="absolute inset-0 bg-white/10 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <RefreshCw className="w-4 h-4 animate-spin text-white" />
        </motion.div>
      )}
      <div className={cn("flex items-center gap-2 transition-all", isLoading ? "opacity-0 scale-90" : "opacity-100 scale-100")}>
        {Icon && <Icon className={cn("w-3.5 h-3.5", !isLoading && "group-hover:rotate-12 transition-transform")} />}
        {children}
      </div>
    </button>
  );
};

const SyncMatrix = ({ items, providers, settings, onManualSync, onUpdate, addToast }: { items: SyncMatrixItem[], providers: Provider[], settings: any, onManualSync: (id: string) => void, onUpdate: () => void, addToast: any }) => {
  const getProvider = (id: string) => providers.find(p => p.id === id);
  const [selectedItem, setSelectedItem] = useState<SyncMatrixItem | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    await Promise.all(items.map(item => onManualSync(item.id)));
    addToast('Batch Sync Initiated', `Manual synchronization triggered for ${items.length} repositories.`, 'info');
    setTimeout(() => setIsSyncingAll(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Sync Matrix</h3>
        <ReactionButton
          onClick={handleSyncAll}
          isLoading={isSyncingAll}
          icon={RefreshCw}
          variant="ghost"
          className="text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/10"
        >
          Sync All Nodes
        </ReactionButton>
      </div>
      <AnimatePresence>
        {selectedItem && (
          <SyncManagementModal item={selectedItem} onClose={() => setSelectedItem(null)} onUpdate={onUpdate} addToast={addToast} />
        )}
      </AnimatePresence>
      <div className="hidden md:grid grid-cols-6 gap-4 px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
        <div className="col-span-1">Source Repository</div>
        <div className="col-span-1">Branch / Commit</div>
        <div className="col-span-1">Performance</div>
        <div className="col-span-1">Source Node</div>
        <div className="col-span-2">Target Nodes & Status</div>
      </div>
      
      <div className="space-y-3">
        {items.length === 0 && (
          <div className="glass-card p-12 text-center border-dashed border-white/10">
            <RefreshCw className="w-12 h-12 text-slate-700 mx-auto mb-4 animate-spin-slow" />
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">No Syncs Configured</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2 max-w-xs mx-auto">
              Configure your first repository mirror in the Source tab to begin synchronization.
            </p>
          </div>
        )}
        {items.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => setSelectedItem(item)}
            className="glass-card p-4 md:p-6 group hover:border-cyan-500/30 transition-all relative overflow-hidden cursor-pointer"
          >
            {/* Background Sync Animation */}
            <div className="absolute inset-0 pointer-events-none opacity-5">
              <svg className="w-full h-full">
                <motion.path
                  d="M 0 50 Q 250 10 500 50 T 1000 50"
                  fill="none"
                  stroke="#00f3ff"
                  strokeWidth="1"
                  animate={{ strokeDashoffset: [0, -100] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  style={{ strokeDasharray: "5 10" }}
                />
              </svg>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center relative z-10">
              <div className="col-span-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-cyan-500/30 transition-colors">
                    <Github className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div>
                   <span className="text-white font-black tracking-tight block">{item.source_repo}</span>
                   <div className="flex items-center gap-2 mt-1">
                     <div className="flex gap-1 mr-2">
                       {(item.entities || ['code']).map(ent => (
                         <div key={ent} title={ent} className="w-3 h-3 rounded-[2px] bg-cyan-500/20 flex items-center justify-center">
                           {ent === 'code' && <Terminal className="w-2 h-2 text-cyan-400" />}
                           {ent === 'issues' && <AlertTriangle className="w-2 h-2 text-cyan-400" />}
                           {ent === 'milestones' && <Flag className="w-2 h-2 text-cyan-400" />}
                           {ent === 'releases' && <Tag className="w-2 h-2 text-cyan-400" />}
                           {ent === 'wiki' && <Book className="w-2 h-2 text-cyan-400" />}
                         </div>
                       ))}
                     </div>
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Interval: {item.sync_interval}m</span>

                      {settings.bidirectional_sync && (
                        <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 text-[8px] font-black uppercase tracking-widest rounded border border-cyan-500/20">Bidirectional</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-1">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-black text-magenta-400 uppercase tracking-widest">
                    <Terminal className="w-3 h-3" />
                    {item.branch || 'main'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    {item.last_commit || '0000000'}
                  </div>
                </div>
              </div>
              <div className="col-span-1">
                <div className="space-y-1">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration: {item.last_sync_duration || 'N/A'}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.success_rate || 0}%` }}
                        className="h-full bg-emerald-500"
                      />
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400">{item.success_rate}%</span>
                  </div>
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 bg-magenta-400 rounded-full glow-magenta" />
                    {getProvider(item.source_provider)?.name || 'Unknown'}
                  </div>
                  <div className="flex items-center gap-1.5 ml-3.5">
                    {getProvider(item.source_provider)?.type.includes('github') ? <Github className="w-2.5 h-2.5 text-slate-600" /> : <Gitlab className="w-2.5 h-2.5 text-slate-600" />}
                    <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter">{getProvider(item.source_provider)?.type}</span>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <div className="flex flex-wrap gap-3 items-center">
                  {item.targets.map((target, tIdx) => {
                    const p = getProvider(target.provider_id);
                    return (
                      <div 
                        key={tIdx} 
                        className={cn(
                          "flex flex-col gap-1 p-2 rounded-xl border transition-all min-w-[140px]",
                          target.status === 'synced' ? "bg-emerald-500/5 border-emerald-500/20" :
                          target.status === 'syncing' ? "bg-cyan-500/5 border-cyan-500/20 shadow-[0_0_15px_rgba(0,243,255,0.05)]" :
                          "bg-red-500/5 border-red-500/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className={cn(
                            "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest",
                            target.status === 'synced' ? "text-emerald-400" :
                            target.status === 'syncing' ? "text-cyan-400" : "text-red-400"
                          )}>
                            {p?.type === 'github' ? <Github className="w-3 h-3" /> : <Gitlab className="w-3 h-3" />}
                            {p?.name}
                          </div>
                          <span className="text-[8px] text-slate-500 font-mono">{target.bytes_transferred || '0B'}</span>
                        </div>
                        
                        {target.status === 'syncing' && (
                          <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${target.progress || 0}%` }}
                              className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(0,243,255,0.5)]"
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter">{target.status}</span>
                          <span className="text-[8px] text-slate-600">{new Date(target.last_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })}
                  <ReactionButton 
                    onClick={(e: any) => { 
                      e.stopPropagation(); 
                      onManualSync(item.id); 
                    }}
                    isLoading={item.targets.some(t => t.status === 'syncing')}
                    icon={RefreshCw}
                    variant="ghost"
                    className="p-2 border-cyan-500/20 text-cyan-400"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const LogItem: React.FC<{ log: Log }> = ({ log }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group relative"
    >
      <div className="flex gap-3">
        <span className="text-slate-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
        <span className={cn(
          "font-bold uppercase tracking-tighter shrink-0",
          log.level === 'error' ? 'text-red-400' : 'text-amber-400'
        )}>{log.level}</span>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-slate-300 leading-relaxed">{log.ui_message}</p>
            <button 
              onClick={() => handleCopy(`${log.ui_message}\n\nTechnical Context:\n${log.technical_context}`)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white/5 hover:bg-white/10 rounded border border-white/10"
              title="Copy details"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
            </button>
          </div>
          <div className="mt-1 p-2 bg-black/40 rounded border border-white/5 hidden group-hover:block transition-all">
            <p className="text-[10px] text-cyan-400/70 mb-1 font-black uppercase tracking-widest">Technical Context</p>
            <code className="text-slate-500 break-all">{log.technical_context}</code>
            {log.resolution && (
              <div className="mt-2 pt-2 border-t border-white/5">
                <p className="text-[10px] text-emerald-400/70 mb-1 font-black uppercase tracking-widest">Suggested Resolution</p>
                <p className="text-slate-400 italic">{log.resolution}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const LogViewer = ({ logs }: { logs: Log[] }) => {
  return (
    <div className="glass-card overflow-hidden border-white/5 bg-black/40">
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">System Terminal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Live</span>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3 font-mono text-[11px] max-h-[500px] overflow-y-auto">
        {logs.map((log, i) => (
          <LogItem key={i} log={log} />
        ))}
      </div>
    </div>
  );
};

const SystemsPage = ({ stats, providersInfo, logs, providers }: { stats: SystemStats | null, providersInfo: ProviderInfo[], logs: Log[], providers: Provider[] }) => {
  return (
    <div className="space-y-8">
      {/* System Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-cyan-500/10 bg-cyan-500/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <h4 className="text-sm font-black text-white uppercase tracking-widest">Resource Usage</h4>
          </div>
          {stats ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Memory (RSS)</span>
                <span className="text-xs font-mono text-cyan-400">{stats.memory.rss}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Heap Used</span>
                <span className="text-xs font-mono text-cyan-400">{stats.memory.heapUsed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CPU (User)</span>
                <span className="text-xs font-mono text-cyan-400">{stats.cpu.user}</span>
              </div>
            </div>
          ) : (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-white/5 rounded w-full" />
              <div className="h-4 bg-white/5 rounded w-full" />
            </div>
          )}
        </div>

        <div className="glass-card p-6 border-magenta-500/10 bg-magenta-500/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-magenta-500/20 rounded-lg">
              <RefreshCw className="w-5 h-5 text-magenta-400" />
            </div>
            <h4 className="text-sm font-black text-white uppercase tracking-widest">Uptime & Environment</h4>
          </div>
          {stats ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Uptime</span>
                <span className="text-xs font-mono text-magenta-400">{stats.uptime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Node Version</span>
                <span className="text-xs font-mono text-magenta-400">{stats.nodeVersion}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Platform</span>
                <span className="text-xs font-mono text-magenta-400">{stats.platform} ({stats.arch})</span>
              </div>
            </div>
          ) : (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-white/5 rounded w-full" />
              <div className="h-4 bg-white/5 rounded w-full" />
            </div>
          )}
        </div>

        <div className="glass-card p-6 border-emerald-500/10 bg-emerald-500/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <h4 className="text-sm font-black text-white uppercase tracking-widest">Docker Context</h4>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Containerized</span>
              <span className="text-xs font-mono text-emerald-400">Yes (Cloud Run)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Isolation Level</span>
              <span className="text-xs font-mono text-emerald-400">gVisor</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Network Mode</span>
              <span className="text-xs font-mono text-emerald-400">Bridge (Overlay)</span>
            </div>
          </div>
        </div>
      </div>

      {/* API Versions & Running Providers Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white/5 rounded-lg">
              <Database className="w-5 h-5 text-slate-400" />
            </div>
            <h4 className="text-sm font-black text-white uppercase tracking-widest">API Versions</h4>
          </div>
          <div className="space-y-3">
            {providersInfo.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-white uppercase tracking-tight">{p.name}</span>
                  <span className="px-1.5 py-0.5 bg-white/10 text-slate-400 text-[8px] font-black uppercase tracking-widest rounded border border-white/10">{p.apiVersion}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest">{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-white/5 rounded-lg">
              <RefreshCw className="w-5 h-5 text-slate-400" />
            </div>
            <h4 className="text-sm font-black text-white uppercase tracking-widest">Running Providers</h4>
          </div>
          <div className="space-y-3">
            {providers.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  {p.type.includes('github') ? <Github className="w-4 h-4 text-slate-400" /> : <Gitlab className="w-4 h-4 text-slate-400" />}
                  <span className="text-xs font-black text-white uppercase tracking-tight">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-mono text-slate-500">{p.baseUrl}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logs Row */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 rounded-lg">
            <Terminal className="w-5 h-5 text-slate-400" />
          </div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest">System Logs</h4>
        </div>
        <LogViewer logs={logs} />
      </div>
    </div>
  );
};

const SyncManagementModal = ({ item, onClose, onUpdate, addToast }: { item: SyncMatrixItem, onClose: () => void, onUpdate: () => void, addToast: any }) => {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'settings'>('history');
  const [entities, setEntities] = useState<string[]>(item.entities || ['code']);
  const [isUpdating, setIsSaving] = useState(false);

  const toggleEntity = (ent: string) => {
    setEntities(prev => prev.includes(ent) ? prev.filter(e => e !== ent) : [...prev, ent]);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetchWithAuth(`/api/v1/system/sync-matrix/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ entities })
      });
      if (res.ok) {
        addToast('Configuration Updated', `Mirror settings for ${item.source_repo} have been applied successfully.`, 'success');
        onUpdate();
        onClose();
      } else {
        addToast('Update Failed', 'Server rejected the configuration change.', 'error');
      }
    } catch (err) {
      addToast('System Error', 'Failed to communicate with the sync engine.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="glass-card w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col border-white/10"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Mirror Management</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              {item.source_repo} • <span className="text-magenta-400">{item.branch || 'main'}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
              <button 
                onClick={() => setActiveSubTab('history')}
                className={cn("px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all", activeSubTab === 'history' ? "bg-white/10 text-cyan-400" : "text-slate-500 hover:text-white")}
              >History</button>
              <button 
                onClick={() => setActiveSubTab('settings')}
                className={cn("px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all", activeSubTab === 'settings' ? "bg-white/10 text-cyan-400" : "text-slate-500 hover:text-white")}
              >Settings</button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-4">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeSubTab === 'history' ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Successful Sync</p>
                      <p className="text-[10px] text-slate-500 font-mono">Commit: {Math.random().toString(16).slice(2, 9)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{new Date(Date.now() - i * 3600000).toLocaleString()}</p>
                    <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mt-1">Duration: {Math.floor(Math.random() * 60)}s</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8 py-4">
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Synchronized Entities</h4>
                <div className="grid grid-cols-2 gap-4">
                  {['code', 'issues', 'milestones', 'releases', 'wiki'].map(ent => (
                    <button
                      key={ent}
                      onClick={() => toggleEntity(ent)}
                      className={cn(
                        "p-4 rounded-xl border flex items-center justify-between transition-all",
                        entities.includes(ent) 
                          ? "bg-cyan-500/10 border-cyan-500/40 text-white" 
                          : "bg-white/5 border-white/10 text-slate-500 hover:border-white/20"
                      )}
                    >
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{ent}</span>
                      {entities.includes(ent) ? <CheckCircle2 className="w-4 h-4 text-cyan-400" /> : <Circle className="w-4 h-4 opacity-20" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/10">
                <p className="text-[10px] text-cyan-400/60 leading-relaxed font-bold uppercase tracking-widest">
                  Changes will take effect during the next scheduled synchronization cycle. Active syncs cannot be modified.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end gap-3">
          {activeSubTab === 'settings' && (
            <ReactionButton
              onClick={handleSaveSettings}
              disabled={isUpdating}
              isLoading={isUpdating}
              variant="primary"
            >
              {isUpdating ? 'Saving...' : 'Apply Changes'}
            </ReactionButton>
          )}
          <ReactionButton
            onClick={onClose}
            variant="ghost"
          >
            Close Management
          </ReactionButton>
        </div>
      </motion.div>
    </motion.div>
  );
};
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('hydrozoa_token');
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  const res = await fetch(url, { ...options, headers });
  
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('hydrozoa_token');
    window.location.reload();
    throw new Error("Unauthorized");
  }
  
  return res;
};

const SourceSelection = ({ providers, onRefresh, namespaces, setNamespaces, setProvisioningSummary, syncMatrix, addToast }: { providers: Provider[], onRefresh: () => void, namespaces: Namespace[], setNamespaces: React.Dispatch<React.SetStateAction<Namespace[]>>, setProvisioningSummary: (summary: any[] | null) => void, syncMatrix: SyncMatrixItem[], addToast: any }) => {
  const [expandedNamespace, setExpandedNamespace] = useState<string | null>(null);
  const [repos, setRepos] = useState<Record<string, Repository[]>>({});
  const [repoPages, setRepoPages] = useState<Record<string, number>>({});
  const [hasMoreRepos, setHasMoreRepos] = useState<Record<string, boolean>>({});
  const [isLoadingRepos, setIsLoadingRepos] = useState<Record<string, boolean>>({});
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [selectedNamespaces, setSelectedNamespaces] = useState<Set<string>>(new Set());
  const [selectedTargetProviders, setSelectedTargetProviders] = useState<Set<string>>(new Set());
  const [syncEntities, setSyncEntities] = useState<string[]>(["code"]);
  const [repoEntities, setRepoEntities] = useState<Record<string, string[]>>({});
  const [repoBranches, setRepoBranches] = useState<Record<string, string>>({});

  const [isSaving, setIsSaving] = useState(false);

  const handleDeleteMirror = async (e: React.MouseEvent, repoName: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to permanently decommission mirroring for ${repoName}?`)) return;
    
    const existingSync = syncMatrix.find(m => m.source_repo === repoName);
    if (!existingSync) return;

    try {
      const res = await fetchWithAuth(`/api/v1/system/sync-matrix/${existingSync.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast('Mirror Decommissioned', `${repoName} has been removed from the sync matrix.`, 'success');
        onRefresh();
      } else {
        addToast('Action Failed', 'The server could not process the decommission request.', 'error');
      }
    } catch (err) {
      addToast('System Error', 'Failed to communicate with the Hydrozoa backend.', 'error');
    }
  };

  // Initialize from syncMatrix
  useEffect(() => {
    if (syncMatrix.length > 0) {
      const repos = new Set<string>();
      const targets = new Set<string>();
      
      syncMatrix.forEach(item => {
        // Find repo ID if we have it in our loaded repos
        // This is tricky because we might not have loaded the namespace yet
        // For now, we'll track by name if ID isn't available, but the system uses IDs
        // However, the sync_matrix stores source_repo as name/path string
        repos.add(item.source_repo);
        item.targets.forEach(t => targets.add(t.provider_id));
      });
      
      setSelectedRepos(repos);
      setSelectedTargetProviders(targets);
    }
  }, [syncMatrix]);

  const toggleEntity = (entity: string) => {
    setSyncEntities(prev => 
      prev.includes(entity) ? prev.filter(e => e !== entity) : [...prev, entity]
    );
  };

  const toggleRepoEntity = (repoId: string, entity: string) => {
    setRepoEntities(prev => {
      const current = prev[repoId] || syncEntities;
      const updated = current.includes(entity) 
        ? current.filter(e => e !== entity) 
        : [...current, entity];
      return { ...prev, [repoId]: updated };
    });
  };

  const updateRepoBranch = (repoId: string, branch: string) => {
    setRepoBranches(prev => ({ ...prev, [repoId]: branch }));
  };

  const sourceProvider = providers.find(p => p.isSource);

  useEffect(() => {
    if (sourceProvider && namespaces.length === 0) {
      fetchWithAuth('/api/v1/source/namespaces')
        .then(res => res.ok ? res.json() : [])
        .then(data => setNamespaces(Array.isArray(data) ? data : []))
        .catch(() => setNamespaces([]));
    }
  }, [sourceProvider, namespaces.length]);

  const fetchReposPage = async (nsId: string, page: number) => {
    setIsLoadingRepos(prev => ({ ...prev, [nsId]: true }));
    try {
      const perPage = 50;
      const res = await fetchWithAuth(`/api/v1/source/namespaces/${nsId}/repos?page=${page}&per_page=${perPage}`);
      const data = await res.json();
      const newRepos = Array.isArray(data) ? data : [];
      
      setRepos(prev => ({ 
        ...prev, 
        [nsId]: page === 1 ? newRepos : [...(prev[nsId] || []), ...newRepos] 
      }));
      setHasMoreRepos(prev => ({ ...prev, [nsId]: newRepos.length === perPage }));
      setRepoPages(prev => ({ ...prev, [nsId]: page }));
    } catch (err) {
      addToast('Discovery Failed', 'Could not fetch repositories for this namespace.', 'error');
    } finally {
      setIsLoadingRepos(prev => ({ ...prev, [nsId]: false }));
    }
  };

  const toggleNamespace = async (nsId: string) => {
    if (expandedNamespace === nsId) {
      setExpandedNamespace(null);
    } else {
      setExpandedNamespace(nsId);
      if (!repos[nsId]) {
        await fetchReposPage(nsId, 1);
      }
    }
  };

  const handleLoadMore = (e: React.MouseEvent, nsId: string) => {
    e.stopPropagation();
    fetchReposPage(nsId, (repoPages[nsId] || 1) + 1);
  };

  const handleNamespaceCheck = async (nsId: string) => {
    const newSelectedNamespaces = new Set(selectedNamespaces);
    const newSelectedRepos = new Set(selectedRepos);
    const isSelected = selectedNamespaces.has(nsId);

    if (isSelected) {
      newSelectedNamespaces.delete(nsId);
      // Uncheck all repos in this namespace EXCEPT those already synced
      const nsRepos = repos[nsId] || [];
      nsRepos.forEach((r: Repository) => {
        if (!syncMatrix.some(item => item.source_repo === r.name)) {
          newSelectedRepos.delete(r.id);
        }
      });
    } else {
      newSelectedNamespaces.add(nsId);
      // Check all repos in this namespace
      const nsRepos = repos[nsId] || await (await fetchWithAuth(`/api/v1/source/namespaces/${nsId}/repos`)).json();
      nsRepos.forEach((r: Repository) => newSelectedRepos.add(r.id));
      if (!repos[nsId]) setRepos(prev => ({ ...prev, [nsId]: nsRepos }));
    }

    setSelectedNamespaces(newSelectedNamespaces);
    setSelectedRepos(newSelectedRepos);
  };

  const handleRepoCheck = (nsId: string, repoName: string) => {
    const newSelectedRepos = new Set(selectedRepos);
    if (newSelectedRepos.has(repoName)) {
      newSelectedRepos.delete(repoName);
    } else {
      newSelectedRepos.add(repoName);
    }
    setSelectedRepos(newSelectedRepos);
  };

  const toggleTargetProvider = (id: string) => {
    const newTargets = new Set(selectedTargetProviders);
    if (newTargets.has(id)) newTargets.delete(id);
    else newTargets.add(id);
    setSelectedTargetProviders(newTargets);
  };

  const selectAll = async () => {
    const newSelectedRepos = new Set(selectedRepos);
    const newSelectedNamespaces = new Set(namespaces.map(n => n.id));
    
    addToast('Batch Processing', 'Preparing to select all repositories from source...', 'info');
    
    try {
      for (const ns of namespaces) {
        if (!repos[ns.id]) {
          const res = await fetchWithAuth(`/api/v1/source/namespaces/${ns.id}/repos?per_page=1000&type=${ns.type}`);
          if (res.ok) {
            const nsRepos = await res.json();
            setRepos(prev => ({ ...prev, [ns.id]: nsRepos }));
            nsRepos.forEach((r: Repository) => newSelectedRepos.add(r.name));
          }
        } else {
          repos[ns.id].forEach((r: Repository) => newSelectedRepos.add(r.name));
        }
      }
      
      setSelectedNamespaces(newSelectedNamespaces);
      setSelectedRepos(newSelectedRepos);
      addToast('Selection Complete', 'All repositories have been checked.', 'success');
    } catch (err) {
      addToast('Selection Error', 'Failed to retrieve some nodes during batch selection.', 'error');
    }
  };

  const saveSelection = async () => {
    if (selectedRepos.size === 0) {
      addToast('Selection Required', 'Please select at least one repository to mirror.', 'warning');
      return;
    }
    if (selectedTargetProviders.size === 0) {
      addToast('Target Required', 'Please select at least one target mirror node.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      // Find full repo objects for the selected IDs
      const selectedRepoObjects = Array.from(selectedRepos).map(id => {
        for (const nsId in repos) {
          const repo = repos[nsId].find(r => r.id === id);
          if (repo) return repo;
        }
        return { id, name: `repo-${id}`, description: "Automated mirror target", visibility: 'private' as const }; // Fallback
      });

      const res = await fetchWithAuth('/api/v1/source/selection', {
        method: 'POST',
        body: JSON.stringify({ 
          selectedRepos: selectedRepoObjects.map(r => ({
            ...r,
            entities: repoEntities[r.id] || syncEntities,
            branch: repoBranches[r.id] || 'main'
          })),
          targetProviderIds: Array.from(selectedTargetProviders),
          entities: syncEntities // Global default
        })
      });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.summary)) {
        setProvisioningSummary(data.summary);
      }
      if (res.ok) {
        await onRefresh();
        const failed = Number(data.failed || 0);
        addToast(
          failed > 0 ? 'Provisioning Partially Completed' : 'Mirroring Configured',
          failed > 0
            ? `${data.succeeded || 0} targets configured; ${failed} failed. Review the provisioning summary.`
            : `${data.succeeded || selectedRepos.size} mirror targets were configured.`,
          failed > 0 ? 'warning' : 'success'
        );
      } else {
        const firstFailure = data.summary?.find((item: any) => item.status === 'failed');
        addToast(
          'Provisioning Failed',
          firstFailure?.detail || firstFailure?.message || data.error || `The server returned HTTP ${res.status}.`,
          'error'
        );
      }
    } catch (err) {
      addToast('Connection Error', 'Failed to communicate with the Hydrozoa backend.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const deselectAll = () => {
    // Only deselect those NOT in the syncMatrix
    const newSelectedRepos = new Set<string>();
    syncMatrix.forEach(item => newSelectedRepos.add(item.source_repo));
    
    setSelectedRepos(newSelectedRepos);
    setSelectedNamespaces(new Set());
  };

  const sourceProviderObj = providers.find(p => p.isSource);
  const targetProviders = providers.filter(p => !p.isSource);

  return (
    <div className="space-y-8">
      {/* Node Role Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Source Node Info - Reference Only */}
        <div className="col-span-1 glass-card p-6 border-magenta-500/20 bg-magenta-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Box className="w-16 h-16 text-magenta-400" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-magenta-500/20 rounded-lg flex items-center justify-center">
              <Box className="w-5 h-5 text-magenta-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tighter">Source Node</h3>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Primary repository origin</p>
            </div>
          </div>
          
          {sourceProviderObj ? (
            <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="p-2 bg-magenta-500/20 rounded-lg">
                {sourceProviderObj.type === 'github' ? <Github className="w-5 h-5 text-magenta-400" /> : <Gitlab className="w-5 h-5 text-magenta-400" />}
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-white uppercase tracking-widest">{sourceProviderObj.name}</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">{sourceProviderObj.type}</p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[9px] text-red-400 font-bold uppercase tracking-widest text-center">
              No source provider configured
            </div>
          )}
        </div>

        {/* Target Mirror Selection */}
        <div className="col-span-3 glass-card p-6 border-cyan-500/10 bg-cyan-500/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Target Mirror Nodes</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Select providers where repositories will be automatically provisioned and mirrored.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {targetProviders.map((p) => (
              <button
                key={p.id}
                onClick={() => toggleTargetProvider(p.id)}
                className={cn(
                  "p-4 rounded-2xl border transition-all flex items-center gap-4 group",
                  selectedTargetProviders.has(p.id) 
                    ? "bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_20px_rgba(0,243,255,0.1)]" 
                    : "bg-white/5 border-white/5 hover:border-white/20"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  selectedTargetProviders.has(p.id) ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-slate-500"
                )}>
                  {p.type === 'github' ? <Github className="w-5 h-5" /> : <Gitlab className="w-5 h-5" />}
                </div>
                <div className="text-left">
                  <p className={cn(
                    "text-xs font-black uppercase tracking-widest",
                    selectedTargetProviders.has(p.id) ? "text-white" : "text-slate-500"
                  )}>{p.name}</p>
                  <p className="text-[8px] text-slate-600 font-bold uppercase tracking-tighter mt-0.5">{p.type}</p>
                </div>
                <div className="ml-auto">
                  {selectedTargetProviders.has(p.id) ? (
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-800" />
                  )}
                </div>
              </button>
            ))}
            {targetProviders.length === 0 && (
              <div className="col-span-full py-8 text-center bg-black/20 rounded-2xl border border-dashed border-white/5">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">No target adapters available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-magenta-500/20 rounded-xl flex items-center justify-center">
            <Box className="w-6 h-6 text-magenta-400" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Source Selection</h3>
            <div className="flex gap-2 mt-1">
              {['code', 'issues', 'milestones', 'wiki', 'releases', 'snippets'].map(entity => (
                <button
                  key={entity}
                  onClick={() => toggleEntity(entity)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border transition-all",
                    syncEntities.includes(entity)
                      ? "bg-magenta-500/20 border-magenta-500/40 text-magenta-400"
                      : "bg-white/5 border-white/10 text-slate-500 hover:border-white/20"
                  )}
                >
                  {entity}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {sourceProvider && (
              <ReactionButton 
                onClick={onRefresh}
                isLoading={isLoadingRepos[namespaces[0]?.id]} // Or a general isRefreshing state
                icon={RefreshCw}
                variant="ghost"
                className="text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/10"
              >
                Refresh Repos
              </ReactionButton>
            )}
            <ReactionButton 
              onClick={saveSelection}
              disabled={!sourceProvider}
              isLoading={isSaving}
              variant="primary"
              className="px-6"
            >
              {isSaving ? 'Provisioning...' : 'Initiate Mirroring'}
            </ReactionButton>
            <ReactionButton 
              onClick={selectAll}
              variant="ghost"
              className="text-cyan-400 border-cyan-500/20"
            >
              Select All
            </ReactionButton>
            <ReactionButton 
              onClick={deselectAll}
              variant="ghost"
            >
              Deselect All
            </ReactionButton>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {namespaces.length === 0 && (
          <div className="glass-card p-12 text-center border-dashed border-white/10">
            <Database className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-black text-white uppercase tracking-tighter">No Source Providers Connected</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2 max-w-xs mx-auto">
              Connect a source provider in the Providers tab to browse repositories and namespaces.
            </p>
          </div>
        )}
        {namespaces.map((ns) => (
          <div key={ns.id} className="glass-card overflow-hidden border-white/5">
            <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => toggleNamespace(ns.id)}>
              <div className="flex items-center gap-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleNamespaceCheck(ns.id); }}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  {selectedNamespaces.has(ns.id) ? (
                    <CheckCircle2 className="w-5 h-5 text-cyan-400 glow-cyan" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-600" />
                  )}
                </button>
                <div>
                  <p className="text-sm font-black text-white tracking-tight">{ns.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{ns.type} • {ns.repo_count} repos</p>
                </div>
              </div>
              <ChevronDown className={cn("w-5 h-5 text-slate-500 transition-transform", expandedNamespace === ns.id && "rotate-180")} />
            </div>

            <AnimatePresence>
              {expandedNamespace === ns.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/5 bg-black/20"
                >
                  <div className="p-4 space-y-2">
                    {repos[ns.id]?.map((repo) => {
                      const isSynced = syncMatrix.some(item => item.source_repo === repo.name || item.source_repo === `${ns.name}/${repo.name}`);
                      const isSelected = selectedRepos.has(repo.id) || isSynced;
                      
                      return (
                        <div 
                          key={repo.id} 
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg transition-colors group cursor-pointer",
                            isSelected ? "bg-white/5 border border-white/5" : "hover:bg-white/5 border border-transparent"
                          )}
                          onClick={() => handleRepoCheck(ns.id, repo.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-1">
                              {isSelected ? (
                                <CheckCircle2 className="w-4 h-4 text-cyan-400 glow-cyan" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-700" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={cn("text-sm font-bold transition-colors", isSelected ? "text-white" : "text-slate-300 group-hover:text-white")}>{repo.name}</p>
                                <span className={cn(
                                  "text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter border",
                                  repo.visibility === 'public' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                )}>
                                  {repo.visibility}
                                </span>
                                {isSynced && (
                                  <span className="text-[7px] font-black bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded uppercase tracking-widest border border-cyan-500/20 shadow-[0_0_10px_rgba(0,243,255,0.1)]">Configured</span>
                                )}
                              </div>
                              <div className="flex gap-2 items-center mt-1">
                                {isSelected ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex gap-1">
                                      {['code', 'issues', 'milestones', 'releases', 'snippets'].map(ent => (
                                        <button
                                          key={ent}
                                          onClick={(e) => { e.stopPropagation(); toggleRepoEntity(repo.id, ent); }}
                                          className={cn(
                                            "px-1.5 py-0.5 rounded-[4px] text-[7px] font-black uppercase tracking-tighter border transition-all",
                                            (repoEntities[repo.id] || (isSynced ? syncMatrix.find(item => item.source_repo === repo.name || item.source_repo === `${ns.name}/${repo.name}`)?.entities : syncEntities) || []).includes(ent)
                                              ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                                              : "bg-white/5 border-white/10 text-slate-600 hover:border-white/20"
                                          )}
                                        >
                                          {ent}
                                        </button>
                                      ))}
                                    </div>

                                    <div className="flex items-center gap-1 ml-2 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                                      <Terminal className="w-2 h-2 text-slate-500" />
                                      <input 
                                        placeholder="branch"
                                        className="bg-transparent border-none text-[8px] text-magenta-400 font-black uppercase tracking-widest focus:ring-0 w-16 p-0"
                                        value={repoBranches[repo.id] || (isSynced ? syncMatrix.find(item => item.source_repo === repo.name || item.source_repo === `${ns.name}/${repo.name}`)?.branch : 'main') || 'main'}
                                        onChange={(e) => updateRepoBranch(repo.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-600 font-medium">{repo.description || 'No description provided'}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className={cn(
                            "text-[10px] font-black uppercase tracking-widest transition-opacity",
                            isSelected ? "text-cyan-400 opacity-100" : "text-slate-700 opacity-0 group-hover:opacity-100"
                          )}>
                            {isSelected ? (isSynced ? "Mirror Configured" : "Mirror Active") : "Enable Mirror"}
                          </div>
                        </div>
                      );
                    })}
                    
                    {hasMoreRepos[ns.id] && (
                      <button 
                        onClick={(e) => handleLoadMore(e, ns.id)}
                        disabled={isLoadingRepos[ns.id]}
                        className="w-full py-3 mt-2 border border-dashed border-white/10 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:bg-white/5 hover:text-cyan-400 transition-all flex items-center justify-center gap-2"
                      >
                        {isLoadingRepos[ns.id] ? (
                          <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                        {isLoadingRepos[ns.id] ? "Requesting more nodes..." : "Load More Repositories"}
                      </button>
                    )}
                    {!repos[ns.id] && (
                      <div className="flex justify-center py-4">
                        <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppContent />
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'matrix' | 'source' | 'providers' | 'dlq' | 'logs' | 'settings' | 'systems'>(
    (localStorage.getItem('hydrozoa_active_tab') as any) || 'dashboard'
  );

  useEffect(() => {
    localStorage.setItem('hydrozoa_active_tab', activeTab);
  }, [activeTab]);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('hydrozoa_token'));
  const [isDefaultPassword, setIsDefaultPassword] = useState(localStorage.getItem('hydrozoa_is_default') === 'true');
  const [loginError, setLoginError] = useState('');
  const [settings, setSettings] = useState({
    sync_interval: 15,
    encryption_enabled: true,
    log_retention_days: 7,
    max_concurrent_syncs: 5,
    bidirectional_sync: false,
    conflict_strategy: 'source_wins'
  });

  const [providers, setProviders] = useState<Provider[]>([]);
  const [syncMatrix, setSyncMatrix] = useState<SyncMatrixItem[]>([]);
  const [dlqItems, setDlqItems] = useState<DLQItem[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [providersInfo, setProvidersInfo] = useState<ProviderInfo[]>([]);
  const [providerLatencies, setProviderLatencies] = useState<Record<string, { latency: string, status: string }>>({});
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [newProviderType, setNewProviderType] = useState('github');
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [passwordReset, setPasswordReset] = useState({ current: '', new: '', confirm: '' });
  const [passwordResetStatus, setPasswordResetStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [provisioningSummary, setProvisioningSummary] = useState<any[] | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    if (isAuthenticated) {
      setIsAppLoading(true);
      Promise.all([fetchData(), fetchSettings()]).finally(() => setIsAppLoading(false));
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    } else {
      setIsAppLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && providers.length > 0) {
      const fetchLatencies = async () => {
        const results: Record<string, any> = {};
        await Promise.all(providers.map(async (p) => {
          try {
            const res = await fetchWithAuth(`/api/v1/system/ping/${p.id}`);
            if (res.ok) results[p.id] = await res.json();
          } catch (err) {
            results[p.id] = { latency: 'error', status: 'offline' };
          }
        }));
        setProviderLatencies(prev => ({ ...prev, ...results }));
      };
      fetchLatencies();
      const interval = setInterval(fetchLatencies, 15000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, providers.length]);

  const fetchData = async () => {
    try {
      const [providersRes, matrixRes, dlqRes, logsRes, metricsRes, statsRes, infoRes] = await Promise.all([
        fetchWithAuth('/api/v1/auth/providers'),
        fetchWithAuth('/api/v1/system/sync-matrix'),
        fetchWithAuth('/api/v1/system/dlq'),
        fetchWithAuth('/api/v1/logs/translated'),
        fetchWithAuth('/api/v1/analytics/sync-metrics'),
        fetchWithAuth('/api/v1/system/stats'),
        fetchWithAuth('/api/v1/system/providers-info')
      ]);
      
      const providersData = await providersRes.json();
      const matrixData = await matrixRes.json();
      const dlqData = await dlqRes.json();
      const logsData = await logsRes.json();
      const metricsData = await metricsRes.json();
      const statsData = await statsRes.json();
      const infoData = await infoRes.json();

      setProviders(providersData);
      setSyncMatrix(matrixData.sync_matrix);
      setDlqItems(dlqData.dlq_items);
      setLogs(logsData.logs);
      setMetrics(metricsData);
      setSystemStats(statsData);
      setProvidersInfo(infoData.providers);
    } catch (err) {
      addToast('Data Fetch Error', 'Failed to retrieve telemetry and state from server.', 'error');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/system/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      addToast('Settings Error', 'Failed to retrieve system configuration.', 'error');
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('hydrozoa_token', data.token);
        localStorage.setItem('hydrozoa_is_default', data.user.isDefaultPassword ? 'true' : 'false');
        setIsAuthenticated(true);
        setIsDefaultPassword(data.user.isDefaultPassword);
        setLoginError('');
      } else {
        setLoginError('Access Denied. Invalid credentials.');
      }
    } catch (err) {
      setLoginError('System offline. Please try again later.');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("Are you sure you want to decommission this node?")) return;
    try {
      const res = await fetchWithAuth(`/api/v1/auth/providers/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setProviders(providers.filter(p => p.id !== id));
        addToast('Node Decommissioned', 'The provider has been successfully removed from the network.', 'success');
      } else {
        addToast('Action Failed', 'The server could not decommission this node.', 'error');
      }
    } catch (err) {
      addToast('System Error', 'Failed to communicate with the node management system.', 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordReset.new !== passwordReset.confirm) {
      addToast('Validation Error', 'New access keys do not match.', 'warning');
      return;
    }
    try {
      const res = await fetchWithAuth('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordReset.current,
          newPassword: passwordReset.new
        })
      });
      if (res.ok) {
        addToast('Security Updated', 'Access key has been successfully rotated.', 'success');
        setPasswordReset({ current: '', new: '', confirm: '' });
        setIsDefaultPassword(false);
        localStorage.setItem('hydrozoa_is_default', 'false');
      } else {
        const data = await res.json();
        addToast('Update Failed', data.error || 'Invalid credentials.', 'error');
      }
    } catch (err) {
      addToast('System Error', 'Communication with the security layer failed.', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('hydrozoa_token');
    localStorage.removeItem('hydrozoa_is_default');
    localStorage.removeItem('hydrozoa_active_tab');
    setIsAuthenticated(false);
    setIsDefaultPassword(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4 relative overflow-hidden">
        <SyncTentacles />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card w-full max-w-md p-8 relative z-10 border-white/10"
        >
          <div className="flex flex-col items-center mb-8">
            <HydrozoaLogo className="w-20 h-20 mb-4" />
            <h1 className="text-3xl font-black text-white tracking-tighter">HYDROZOA</h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Secure Access Terminal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-xl mb-6">
              <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">Default Credentials</p>
              <p className="text-[9px] text-slate-500 font-mono">ID: admin@hydrozoa.io</p>
              <p className="text-[9px] text-slate-500 font-mono">KEY: hydrozoa-default</p>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Operator ID</label>
              <input 
                name="email" 
                type="email" 
                required 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-medium" 
                placeholder="garvey.snow@gmail.com" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Access Key</label>
              <input 
                name="password" 
                type="password" 
                required 
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-medium" 
                placeholder="••••••••" 
              />
            </div>
            {loginError && (
              <p className="text-red-400 text-[10px] font-black uppercase tracking-widest text-center">{loginError}</p>
            )}
            <ReactionButton 
              type="submit" 
              className="w-full py-4 text-xs"
            >
              Initialize Session
            </ReactionButton>
          </form>
        </motion.div>
      </div>
    );
  }

  if (isAppLoading) {
    return (
      <div className="h-screen w-screen bg-[#0a0f1a] flex items-center justify-center relative overflow-hidden">
        <SyncTentacles />
        <div className="glass-card p-8 flex flex-col items-center border-white/10 z-10">
          <HydrozoaLogo className="w-16 h-16 animate-pulse mb-4" />
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] animate-pulse">Initializing Interface...</p>
        </div>
      </div>
    );
  }

  const handleSetSource = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/auth/providers/${id}/set-source`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setProviders(providers.map(p => ({
          ...p,
          isSource: p.id === id
        })));
        addToast('Source Node Updated', 'Primary adapter has been reconfigured.', 'success');
        // Refresh namespaces if we are on the source tab
        if (activeTab === 'source') {
          fetchWithAuth('/api/v1/source/namespaces')
            .then(res => res.json())
            .then(setNamespaces);
        }
      }
    } catch (err) {
      addToast('Error', 'Failed to update source provider.', 'error');
    }
  };

  const handleManualSync = async (id: string) => {
    const item = syncMatrix.find(s => s.id === id);
    try {
      const res = await fetchWithAuth(`/api/v1/sync/manual/${id}`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setSyncMatrix(syncMatrix.map(s => s.id === id ? data.item : s));
        addToast('Sync Initiated', `Manual mirror started for ${item?.source_repo}`, 'info');
      }
    } catch (err) {
      addToast('Sync Failed', 'Could not trigger manual synchronization.', 'error');
    }
  };

  const handleRefreshRepos = async () => {
    try {
      const res = await fetchWithAuth('/api/v1/source/refresh', {
        method: 'POST'
      });
      if (res.ok) {
        // Re-fetch namespaces
        const nsRes = await fetchWithAuth('/api/v1/source/namespaces');
        const nsData = await nsRes.json();
        setNamespaces(nsData);
        addToast('Discovery Complete', 'Repository cache has been refreshed from source.', 'success');
      }
    } catch (err) {
      addToast('Discovery Error', 'Failed to communicate with source provider.', 'error');
    }
  };

  const handleAddProvider = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const res = await fetchWithAuth('/api/v1/auth/providers', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const newProvider = await res.json();
        setProviders([...providers, newProvider]);
        setIsAddingProvider(false);
        addToast('Node Registered', `Successfully connected ${newProvider.name} to the network.`, 'success');
      } else {
        const error = await res.json().catch(() => ({}));
        addToast(
          'Registration Failed',
          error.error || error.detail || `Provider validation returned HTTP ${res.status}.`,
          'error'
        );
      }
    } catch (err) {
      addToast('System Error', 'Could not register new node.', 'error');
    }
  };

  const handleReplay = async (id: string) => {
    const item = dlqItems.find(i => i.id === id);
    try {
      const res = await fetchWithAuth(`/api/v1/system/dlq/${id}/replay`, { 
        method: 'POST'
      });
      if (res.ok) {
        setDlqItems(dlqItems.filter(item => item.id !== id));
        addToast('Replay Initiated', `Retrying failed mirror for ${item?.repository_id}`, 'success');
      } else {
        addToast('Replay Failed', 'The server could not restart this operation.', 'error');
      }
    } catch (err) {
      addToast('Error', 'Failed to communicate with DLQ service.', 'error');
    }
  };

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'area',
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: true, speed: 800 }
    },
    colors: ['#00f3ff'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [20, 100]
      }
    },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      type: 'datetime',
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#64748b' } }
    },
    yaxis: {
      labels: { style: { colors: '#64748b' } }
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.05)',
      strokeDashArray: 4
    },
    tooltip: { theme: 'dark' }
  };

  return (
    <div className="h-screen w-screen bg-[#0a0f1a] relative overflow-hidden">
      <SyncTentacles />
      
      <div className="flex flex-col h-full w-full relative z-10">
        {/* Global Header */}
        <header className="flex items-center justify-between p-4 glass-card m-2 z-50 relative">
          <div className="flex items-center gap-3">
            <HydrozoaLogo className="w-10 h-10" />
            <h1 className="text-lg font-black text-white tracking-tighter">HYDROZOA</h1>
            <div className="hidden md:flex items-center gap-3 ml-6 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Status: Nominal</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 pr-4 border-r border-white/10">
              <div className="text-right">
                <p className="text-[10px] font-black text-white uppercase tracking-tight">Admin User</p>
                <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">Administrator</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-black text-white">
                AD
              </div>
            </div>
            
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 glass-card hover:bg-white/10 transition-all"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
            </button>
            
            <button 
              onClick={handleLogout}
              className="md:hidden p-2 glass-card hover:bg-red-500/10 hover:text-red-400 transition-all text-slate-400"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
            
            <button 
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-4 py-2 glass-card hover:bg-red-500/10 hover:text-red-400 transition-all text-[10px] font-black uppercase tracking-widest text-slate-400"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-row overflow-hidden">
          {/* Sidebar */}
          <aside className={cn(
            "z-40 transition-all duration-500 ease-in-out flex flex-col border-white/5 shrink-0",
            "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:mt-20",
            "md:relative md:m-4 md:mt-0 md:mr-0 glass-card",
            isMobileMenuOpen ? "translate-x-0" : "max-md:-translate-x-full",
            isSidebarExpanded ? "w-64 md:w-64" : "w-64 md:w-20"
          )}>
        <nav className="flex-1 px-3 space-y-2 mt-4">
          {[
            { id: 'dashboard', icon: Activity, label: 'Dashboard' },
            { id: 'source', icon: Box, label: 'Source Selection' },
            { id: 'matrix', icon: RefreshCw, label: 'Sync Matrix' },
            { id: 'providers', icon: Database, label: 'Providers' },
            { id: 'dlq', icon: AlertTriangle, label: 'Dead Letter Queue' },
            { id: 'systems', icon: Terminal, label: 'Systems' },
            { id: 'logs', icon: History, label: 'System Logs' },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setIsMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group relative",
                activeTab === item.id 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[inset_0_0_10px_rgba(0,243,255,0.1)]" 
                  : "text-slate-500 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", activeTab === item.id && "animate-pulse")} />
              {(isSidebarExpanded || isMobileMenuOpen) && (
                <motion.span 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-black text-xs tracking-widest uppercase whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
              {!isSidebarExpanded && !isMobileMenuOpen && (
                <div className="absolute left-full ml-4 px-2 py-1 bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Toggle (Desktop) */}
        <button 
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="hidden md:flex items-center justify-center p-4 text-slate-500 hover:text-white transition-colors border-t border-white/5"
        >
          <ChevronRight className={cn("w-5 h-5 transition-transform duration-500", isSidebarExpanded && "rotate-180")} />
        </button>

        <div className="p-4 mt-auto">
          <div className={cn(
            "glass-card p-4 bg-cyan-500/5 border-cyan-500/10 transition-all",
            !isSidebarExpanded && !isMobileMenuOpen && "opacity-0"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em]">Secure</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto z-10 min-w-0">
        <AnimatePresence>
          {isDefaultPassword && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight">Security Warning: Default Password Active</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Your account is using the default access key. Please update it in settings immediately.</p>
                </div>
              </div>
              <ReactionButton 
                onClick={() => setActiveTab('settings')}
                className="px-6 py-2 bg-amber-500 text-black hover:bg-amber-400"
              >
                Update Key
              </ReactionButton>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-black text-white capitalize tracking-tighter">{activeTab.replace('_', ' ')}</h2>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Multipoint Mirror Agent</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <ReactionButton 
              onClick={fetchData}
              variant="ghost"
              className="p-3 border-cyan-500/20 text-cyan-400"
              icon={RefreshCw}
            />
            <ReactionButton 
              onClick={handleLogout}
              variant="ghost"
              className="p-3 border-red-500/20 text-red-400"
              icon={X}
            />
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard 
                  title="Active Syncs" 
                  value={syncMatrix.filter((m: any) => m.targets?.some((t: any) => t.status === 'syncing')).length.toString()} 
                  icon={RefreshCw} 
                  color="bg-cyan-500" 
                  delay={0.1} 
                />
                <StatCard 
                  title="Total Repos" 
                  value={syncMatrix.length.toString()} 
                  icon={Box} 
                  color="bg-magenta-500" 
                  delay={0.2} 
                />
                <StatCard 
                  title="DLQ Items" 
                  value={dlqItems.length.toString()} 
                  icon={AlertTriangle} 
                  color="bg-amber-500" 
                  delay={0.3} 
                />
                <StatCard 
                  title="Uptime" 
                  value={systemStats?.uptime || "0s"} 
                  icon={Activity} 
                  color="bg-emerald-500" 
                  delay={0.4} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 glass-card p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white uppercase tracking-widest">Sync Throughput</h3>
                    <select className="bg-transparent border-none text-xs font-bold text-slate-500 focus:ring-0 uppercase tracking-widest cursor-pointer hover:text-cyan-400 transition-colors">
                      <option>Last 24 Hours</option>
                      <option>Last 7 Days</option>
                    </select>
                  </div>
                  <div className="h-[300px]">
                    <Chart
                      options={chartOptions}
                      series={[{ name: 'Sync Events', data: metrics }]}
                      type="area"
                      height="100%"
                    />
                  </div>
                </div>

                <div className="glass-card p-6">
                  <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-widest">Recent Activity</h3>
                  <div className="space-y-4">
                    {logs.slice(0, 5).map((log, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="flex gap-4 pb-4 border-b border-white/5 last:border-0"
                      >
                        <div className={cn(
                          "w-2 h-2 mt-1.5 rounded-full shrink-0 shadow-sm",
                          log.level === 'error' ? 'bg-red-500 shadow-red-500/50' : 'bg-amber-500 shadow-amber-500/50'
                        )} />
                        <div>
                          <p className="text-sm text-white font-bold leading-tight">{log.ui_message}</p>
                          <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-wider">{new Date(log.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-card p-6 border-cyan-500/10 bg-cyan-500/5">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                        <Activity className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Sync Performance</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Duration of latest mirroring operations</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-[250px]">
                    <Chart
                      options={{
                        chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
                        plotOptions: { bar: { borderRadius: 4, horizontal: true, barHeight: '40%' } },
                        dataLabels: { enabled: false },
                        grid: { borderColor: '#1e293b', strokeDashArray: 4 },
                        xaxis: { 
                          categories: syncMatrix.slice(0, 5).map(m => m.source_repo.split('/').pop()),
                          labels: { style: { colors: '#64748b', fontSize: '10px', fontWeight: 800 } } 
                        },
                        yaxis: { labels: { style: { colors: '#94a3b8', fontSize: '10px', fontWeight: 800 } } },
                        colors: ['#00f3ff'],
                        theme: { mode: 'dark' }
                      }}
                      series={[{ 
                        name: 'Duration (seconds)', 
                        data: syncMatrix.slice(0, 5).map(m => parseInt(m.last_sync_duration?.replace('s', '') || '0')) 
                      }]}
                      type="bar"
                      height="100%"
                    />
                  </div>
                </div>

                <div className="glass-card p-6 border-cyan-500/10 bg-cyan-500/5">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">Active Synchronizations</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Real-time status of running operations</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {syncMatrix.filter(m => m.targets.some(t => t.status === 'syncing')).length === 0 ? (
                      <div className="py-8 text-center bg-black/20 rounded-2xl border border-dashed border-white/5">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">No operations currently running</p>
                      </div>
                    ) : (
                      syncMatrix.filter(m => m.targets.some(t => t.status === 'syncing')).map((item, idx) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-xl bg-white/5 border border-cyan-500/20 relative overflow-hidden group"
                        >
                          <div className="absolute top-0 right-0 w-16 h-16 blur-2xl -mr-8 -mt-8 bg-cyan-500/20 animate-pulse" />
                          <div className="flex items-center justify-between mb-3 relative z-10">
                            <p className="text-sm font-black text-white truncate max-w-[70%]">{item.source_repo}</p>
                            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-[8px] font-black uppercase tracking-widest rounded shadow-[0_0_10px_rgba(0,243,255,0.2)] animate-pulse">Syncing</span>
                          </div>
                          <div className="space-y-2 relative z-10">
                            {item.targets.filter(t => t.status === 'syncing').map((target, tIdx) => {
                              const p = providers.find(prov => prov.id === target.provider_id);
                              return (
                                <div key={tIdx} className="flex flex-col gap-1.5 p-2 bg-black/40 rounded-lg">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{p?.name || 'Unknown'}</span>
                                    <span className="text-[9px] font-mono text-cyan-400">{target.progress || 0}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${target.progress || 0}%` }}
                                      className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(0,243,255,0.5)]"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'source' && (
            <motion.div
              key="source"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <SourceSelection 
                providers={providers} 
                onRefresh={fetchData}
                namespaces={namespaces} 
                setNamespaces={setNamespaces} 
                setProvisioningSummary={setProvisioningSummary}
                syncMatrix={syncMatrix}
                addToast={addToast}
              />

            </motion.div>
          )}

          {activeTab === 'matrix' && (
            <motion.div
              key="matrix"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <SyncMatrix items={syncMatrix} providers={providers} settings={settings} onManualSync={handleManualSync} onUpdate={fetchData} addToast={addToast} />
            </motion.div>
          )}

          {activeTab === 'providers' && (
            <motion.div
              key="providers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Connected Adapters</h3>
                <ReactionButton 
                  onClick={() => setIsAddingProvider(true)}
                  icon={Plus}
                  className="px-6"
                >
                  Add Provider
                </ReactionButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {providers.map((p, idx) => (
                  <motion.div 
                    key={p.id} 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="glass-card p-6 group hover:border-cyan-500/30 transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-cyan-500/10 transition-all" />
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div className={cn(
                        "p-4 rounded-2xl transition-colors border relative",
                        p.isSource ? "bg-cyan-500/10 border-cyan-500/20" : "bg-white/5 border-white/5 group-hover:bg-white/10"
                      )}>
                        {p.type.includes('github') ? (
                          <Github className={cn("w-8 h-8", p.isSource ? "text-cyan-400" : "text-slate-300")} />
                        ) : p.type.includes('gitlab') ? (
                          <Gitlab className={cn("w-8 h-8", p.isSource ? "text-magenta-400" : "text-slate-300")} />
                        ) : (
                          <Database className={cn("w-8 h-8", p.isSource ? "text-amber-400" : "text-slate-300")} />
                        )}
                        
                        <div className={cn(
                          "absolute -top-2 -right-2 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest shadow-lg",
                          p.isSource 
                            ? "bg-cyan-500 text-white shadow-cyan-500/50" 
                            : "bg-slate-800 text-slate-400"
                        )}>
                          {p.isSource ? "Source" : "Target"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className={cn(
                          "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border flex items-center gap-1.5",
                          (providerLatencies[p.id]?.status === 'healthy' || !providerLatencies[p.id]) 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        )}>
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full animate-pulse",
                            (providerLatencies[p.id]?.status === 'healthy' || !providerLatencies[p.id]) ? "bg-emerald-500" : "bg-red-500"
                          )} />
                          {providerLatencies[p.id]?.status || 'Checking...'}
                        </div>
                        <span className="text-[8px] text-slate-600 font-mono mt-1 uppercase tracking-widest">
                          Latency: {providerLatencies[p.id]?.latency || '---'}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xl font-black text-white mb-1 tracking-tight relative z-10">{p.name}</h4>
                    <p className="text-xs text-slate-500 mb-6 truncate font-medium relative z-10">{p.baseUrl}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3 h-3 text-slate-600" />
                        <span className="text-[10px] text-slate-600 font-black font-mono tracking-widest">{p.token}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {!p.isSource && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSetSource(p.id); }}
                            className="text-[10px] text-emerald-400 font-black uppercase tracking-widest hover:text-white transition-colors"
                          >
                            Set Source
                          </button>
                        )}
                        <button 
                          onClick={() => setEditingProvider(p)}
                          className="text-[10px] text-cyan-400 font-black uppercase tracking-widest hover:text-white transition-colors"
                        >
                          Configure
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {editingProvider && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="glass-card w-full max-w-md p-8 bg-[#0a0f1a] border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                  >
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                        <Settings className="w-6 h-6 text-cyan-400" />
                      </div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Manage Node</h3>
                    </div>

                    <div className="space-y-6">
                      <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Node Name</p>
                          <p className="text-lg font-black text-white">{editingProvider.name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Endpoint</p>
                          <p className="text-xs font-mono text-slate-400">{editingProvider.baseUrl}</p>
                        </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Decommission Node</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">Removing this node will halt all active synchronizations and purge local cache. This action is irreversible.</p>
                        <ReactionButton 
                          onClick={() => {
                            handleDeleteProvider(editingProvider.id);
                            setEditingProvider(null);
                          }}
                          variant="danger"
                          className="w-full py-4"
                        >
                          Confirm Decommissioning
                        </ReactionButton>
                      </div>

                      <ReactionButton 
                        onClick={() => setEditingProvider(null)}
                        variant="ghost"
                        className="w-full py-4"
                      >
                        Close
                      </ReactionButton>
                    </div>
                  </motion.div>
                </div>
              )}

              {provisioningSummary && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="glass-card w-full max-w-2xl p-8 bg-[#0a0f1a] border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Provisioning Summary</h3>
              </div>
              <ReactionButton onClick={() => setProvisioningSummary(null)} variant="ghost" className="p-2" icon={X} />
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {provisioningSummary.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      item.status === 'created' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" :
                      item.status === 'exists' ? "bg-cyan-500" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    )} />
                    <div>
                      <p className="text-sm font-black text-white tracking-tight">{item.repo}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.provider} • {item.status}</p>
                    </div>
                  </div>
                  <p className="text-[10px] font-medium text-slate-400 max-w-[200px] text-right">{item.message}</p>
                </div>
              ))}
            </div>

            <ReactionButton 
              onClick={() => setProvisioningSummary(null)}
              variant="primary"
              className="w-full mt-8 py-4"
            >
              Continue to Dashboard
            </ReactionButton>
          </motion.div>
        </div>
      )}

      {isAddingProvider && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="glass-card w-full max-w-md p-8 bg-[#0a0f1a] border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Register Node</h3>
            </div>
            <form onSubmit={handleAddProvider} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Display Name</label>
                <input name="name" required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all font-medium" placeholder="e.g. Corporate GitLab" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Adapter Type</label>
                <select name="type" value={newProviderType} onChange={(e) => setNewProviderType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-medium cursor-pointer">
                  <option className="bg-slate-900 text-white" value="github">GitHub</option>
                  <option className="bg-slate-900 text-white" value="gitlab">GitLab (Cloud)</option>
                  <option className="bg-slate-900 text-white" value="gitlab_self_hosted">GitLab (Self-Hosted)</option>
                  <option className="bg-slate-900 text-white" value="gitea">Gitea</option>
                  <option className="bg-slate-900 text-white" value="forgejo">Forgejo</option>
                  <option className="bg-slate-900 text-white" value="gogs">Gogs</option>
                  <option className="bg-slate-900 text-white" value="bitbucket">Bitbucket</option>
                </select>
              </div>
              {['github', 'gitlab', 'bitbucket'].includes(newProviderType) ? (
                <input type="hidden" name="baseUrl" value={newProviderType === 'github' ? 'https://github.com' : newProviderType === 'gitlab' ? 'https://gitlab.com' : 'https://bitbucket.org'} />
              ) : (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Base URL</label>
                  <input name="baseUrl" required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-medium" placeholder="https://git.company.com" />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Personal Access Token</label>
                <input name="token" type="password" required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-medium" placeholder="glpat-xxxxxxxxxxxxxxx" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Webhook Secret (Optional)</label>
                <input name="webhookSecret" type="password" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-medium" placeholder="Secret for HMAC verification" />
              </div>
              <div className="flex gap-4 pt-6">
                <ReactionButton 
                  type="button" 
                  onClick={() => setIsAddingProvider(false)} 
                  variant="ghost"
                  className="flex-1 py-3"
                >
                  Cancel
                </ReactionButton>
                <ReactionButton 
                  type="submit" 
                  className="flex-1 py-3"
                >
                  Save Node
                </ReactionButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
            </motion.div>
          )}

          {activeTab === 'systems' && (
            <motion.div
              key="systems"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SystemsPage 
                stats={systemStats} 
                providersInfo={providersInfo} 
                logs={logs} 
                providers={providers}
              />
            </motion.div>
          )}

          {activeTab === 'dlq' && (
            <motion.div
              key="dlq"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="glass-card overflow-hidden border-white/5 bg-black/20">
                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Dead Letter Queue</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{dlqItems.length} Items Pending</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                        <th className="px-6 py-4">Repository</th>
                        <th className="px-6 py-4">Target</th>
                        <th className="px-6 py-4">Entity</th>
                        <th className="px-6 py-4">Failure Reason</th>
                        <th className="px-6 py-4">Last Attempt</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {dlqItems.map((item) => (
                        <tr key={item.id} className="group hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-white">{item.repository_id}</td>
                          <td className="px-6 py-4 text-xs text-slate-400 uppercase tracking-widest font-black">{item.target_provider}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-white/5 rounded text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.entity_type}</span>
                          </td>
                          <td className="px-6 py-4 text-xs text-red-400/80 font-medium">{item.failure_reason}</td>
                          <td className="px-6 py-4 text-[10px] text-slate-500 font-mono">{new Date(item.last_attempt).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <ReactionButton 
                              onClick={() => handleReplay(item.id)}
                              variant="ghost"
                              className="p-2 border-cyan-500/20"
                              icon={RefreshCw}
                            />
                          </td>
                        </tr>
                      ))}
                      {dlqItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500/30" />
                              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Queue is currently empty</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <LogViewer logs={logs} />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                  <div className="glass-card p-8 space-y-8 border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                        <Settings className="w-6 h-6 text-cyan-400" />
                      </div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Global Configuration</h3>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Default Sync Interval (Minutes)</label>
                        <div className="flex items-center gap-4">
                          <input 
                            type="range" 
                            min="1" 
                            max="60" 
                            value={settings.sync_interval}
                            onChange={(e) => setSettings({...settings, sync_interval: parseInt(e.target.value)})}
                            className="flex-1 accent-cyan-500" 
                          />
                          <span className="w-12 text-center text-xl font-black text-cyan-400 font-mono">{settings.sync_interval}</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Max Concurrent Syncs</label>
                        <div className="flex items-center gap-4">
                          <input 
                            type="range" 
                            min="1" 
                            max="20" 
                            value={settings.max_concurrent_syncs}
                            onChange={(e) => setSettings({...settings, max_concurrent_syncs: parseInt(e.target.value)})}
                            className="flex-1 accent-magenta-500" 
                          />
                          <span className="w-12 text-center text-xl font-black text-magenta-400 font-mono">{settings.max_concurrent_syncs}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                          <div>
                            <p className="text-sm font-black text-white uppercase tracking-tight">Bidirectional Mirroring</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Sync changes back to source</p>
                          </div>
                          <button 
                            onClick={() => setSettings({...settings, bidirectional_sync: !settings.bidirectional_sync})}
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              settings.bidirectional_sync ? "bg-cyan-500" : "bg-slate-700"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                              settings.bidirectional_sync ? "left-7" : "left-1"
                            )} />
                          </button>
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Conflict Resolution Strategy</label>
                          <select 
                            value={settings.conflict_strategy}
                            onChange={(e) => setSettings({...settings, conflict_strategy: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-medium cursor-pointer"
                          >
                            <option value="source_wins">Source Wins (Overwrite Target)</option>
                            <option value="target_wins">Target Wins (Overwrite Source)</option>
                            <option value="manual">Manual Intervention (DLQ)</option>
                            <option value="latest_wins">Latest Commit Wins</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                          <div>
                            <p className="text-sm font-black text-white uppercase tracking-tight">Encryption Hardening</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">AES-256-GCM for all tokens</p>
                          </div>
                          <button 
                            onClick={() => setSettings({...settings, encryption_enabled: !settings.encryption_enabled})}
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              settings.encryption_enabled ? "bg-cyan-500" : "bg-slate-700"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                              settings.encryption_enabled ? "left-7" : "left-1"
                            )} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card p-8 space-y-8 border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                        <History className="w-6 h-6 text-amber-400" />
                      </div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Data Retention</h3>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Log Retention (Days)</label>
                        <div className="grid grid-cols-4 gap-3">
                          {[1, 7, 30, 90].map((days) => (
                            <button
                              key={days}
                              onClick={() => setSettings({...settings, log_retention_days: days})}
                              className={cn(
                                "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                settings.log_retention_days === days 
                                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]" 
                                  : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
                              )}
                            >
                              {days} Days
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 space-y-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Danger Zone</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">Purging logs or resetting the sync matrix is irreversible. Proceed with extreme caution.</p>
                        <div className="flex gap-3">
                          <ReactionButton variant="danger" className="flex-1" onClick={() => addToast('Logs Cleared', 'System logs have been purged.', 'info')}>Clear Logs</ReactionButton>
                          <ReactionButton variant="danger" className="flex-1" onClick={() => addToast('Matrix Reset', 'Synchronization matrix has been reinitialized.', 'warning')}>Reset Matrix</ReactionButton>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="glass-card p-8 space-y-8 border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-magenta-500/10 rounded-xl flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-magenta-400" />
                      </div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Security & Access</h3>
                    </div>

                    <form onSubmit={handleResetPassword} className="space-y-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Current Access Key</label>
                          <input 
                            type="password" 
                            value={passwordReset.current}
                            onChange={(e) => setPasswordReset({...passwordReset, current: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                            placeholder="••••••••"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">New Access Key</label>
                          <input 
                            type="password" 
                            value={passwordReset.new}
                            onChange={(e) => setPasswordReset({...passwordReset, new: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                            placeholder="••••••••"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Confirm New Key</label>
                          <input 
                            type="password" 
                            value={passwordReset.confirm}
                            onChange={(e) => setPasswordReset({...passwordReset, confirm: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                            placeholder="••••••••"
                            required
                          />
                        </div>
                      </div>

                      {passwordResetStatus && (
                        <div className={cn(
                          "p-4 rounded-xl text-[10px] font-black uppercase tracking-widest border",
                          passwordResetStatus.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                        )}>
                          {passwordResetStatus.message}
                        </div>
                      )}

                      <ReactionButton 
                        type="submit"
                        variant="ghost"
                        className="w-full py-4"
                      >
                        Update Security Credentials
                      </ReactionButton>
                    </form>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <ReactionButton 
                  onClick={async () => {
                    const res = await fetchWithAuth('/api/v1/system/settings', {
                      method: 'POST',
                      body: JSON.stringify(settings)
                    });
                    if (res.ok) {
                      addToast('Configuration Synchronized', 'System settings have been updated and persisted.', 'success');
                    }
                  }}
                  variant="primary"
                  className="px-12 py-4 bg-gradient-to-r from-cyan-500 to-magenta-500 hover:scale-105 active:scale-95"
                >
                  Save System Configuration
                </ReactionButton>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
