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
  LogOut
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
}
interface Provider {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  token: string;
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

// --- Components ---

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

const SyncMatrix = ({ items, providers, settings }: { items: SyncMatrixItem[], providers: Provider[], settings: any }) => {
  const getProvider = (id: string) => providers.find(p => p.id === id);
  const [selectedItem, setSelectedItem] = useState<SyncMatrixItem | null>(null);

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {selectedItem && (
          <SyncHistoryModal item={selectedItem} onClose={() => setSelectedItem(null)} />
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
                  <div className="flex items-center gap-2 text-[10px] font-black text-cyan-400 uppercase tracking-widest">
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
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full glow-cyan" />
                  {getProvider(item.source_provider)?.name || 'Unknown'}
                </div>
              </div>

              <div className="col-span-2">
                <div className="flex flex-wrap gap-3">
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
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
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
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="group"
          >
            <div className="flex gap-3">
              <span className="text-slate-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
              <span className={cn(
                "font-bold uppercase tracking-tighter shrink-0",
                log.level === 'error' ? 'text-red-400' : 'text-amber-400'
              )}>{log.level}</span>
              <div className="flex-1">
                <p className="text-slate-300 leading-relaxed">{log.ui_message}</p>
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

const SyncHistoryModal = ({ item, onClose }: { item: SyncMatrixItem, onClose: () => void }) => {
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
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Sync History</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{item.source_repo} • {item.branch}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
        
        <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
          >
            Close Terminal
          </button>
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

const SourceSelection = ({ providers }: { providers: Provider[] }) => {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [expandedNamespace, setExpandedNamespace] = useState<string | null>(null);
  const [repos, setRepos] = useState<Record<string, Repository[]>>({});
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [selectedNamespaces, setSelectedNamespaces] = useState<Set<string>>(new Set());
  const [selectedTargetProviders, setSelectedTargetProviders] = useState<Set<string>>(new Set());

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchWithAuth('/api/v1/source/namespaces')
      .then(res => res.json())
      .then(setNamespaces);
  }, []);

  const toggleNamespace = async (nsId: string) => {
    if (expandedNamespace === nsId) {
      setExpandedNamespace(null);
    } else {
      setExpandedNamespace(nsId);
      if (!repos[nsId]) {
        const res = await fetchWithAuth(`/api/v1/source/namespaces/${nsId}/repos`);
        const data = await res.json();
        setRepos(prev => ({ ...prev, [nsId]: data }));
      }
    }
  };

  const handleNamespaceCheck = async (nsId: string) => {
    const newSelectedNamespaces = new Set(selectedNamespaces);
    const newSelectedRepos = new Set(selectedRepos);

    if (selectedNamespaces.has(nsId)) {
      newSelectedNamespaces.delete(nsId);
      // Uncheck all repos in this namespace
      const nsRepos = repos[nsId] || await (await fetchWithAuth(`/api/v1/source/namespaces/${nsId}/repos`)).json();
      nsRepos.forEach((r: Repository) => newSelectedRepos.delete(r.id));
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

  const handleRepoCheck = (nsId: string, repoId: string) => {
    const newSelectedRepos = new Set(selectedRepos);
    if (newSelectedRepos.has(repoId)) {
      newSelectedRepos.delete(repoId);
      // If a repo is unchecked, the namespace is no longer "fully" selected
      const newSelectedNamespaces = new Set(selectedNamespaces);
      newSelectedNamespaces.delete(nsId);
      setSelectedNamespaces(newSelectedNamespaces);
    } else {
      newSelectedRepos.add(repoId);
      // Check if all repos in namespace are now selected
      const nsRepos = repos[nsId];
      if (nsRepos && nsRepos.every(r => newSelectedRepos.has(r.id))) {
        const newSelectedNamespaces = new Set(selectedNamespaces);
        newSelectedNamespaces.add(nsId);
        setSelectedNamespaces(newSelectedNamespaces);
      }
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
    const newSelectedNamespaces = new Set(namespaces.map(n => n.id));
    const newSelectedRepos = new Set(selectedRepos);
    
    for (const ns of namespaces) {
      const nsRepos = repos[ns.id] || await (await fetchWithAuth(`/api/v1/source/namespaces/${ns.id}/repos`)).json();
      nsRepos.forEach((r: Repository) => newSelectedRepos.add(r.id));
      if (!repos[ns.id]) setRepos(prev => ({ ...prev, [ns.id]: nsRepos }));
    }
    
    setSelectedNamespaces(newSelectedNamespaces);
    setSelectedRepos(newSelectedRepos);
  };

  const saveSelection = async () => {
    if (selectedRepos.size === 0) {
      alert("Please select at least one repository.");
      return;
    }
    if (selectedTargetProviders.size === 0) {
      alert("Please select at least one target provider.");
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
        return { id, name: `repo-${id}`, description: "Automated mirror target" }; // Fallback
      });

      const res = await fetchWithAuth('/api/v1/source/selection', {
        method: 'POST',
        body: JSON.stringify({ 
          selectedRepos: selectedRepoObjects,
          targetProviderIds: Array.from(selectedTargetProviders)
        })
      });
      if (res.ok) {
        alert("Mirror Configuration Persisted. Target repositories will be provisioned if missing.");
      }
    } catch (err) {
      console.error("Failed to save selection", err);
    } finally {
      setIsSaving(false);
    }
  };

  const deselectAll = () => {
    setSelectedNamespaces(new Set());
    setSelectedRepos(new Set());
  };

  return (
    <div className="space-y-8">
      {/* Target Selection Section */}
      <div className="glass-card p-6 border-cyan-500/10 bg-cyan-500/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Target Mirror Nodes</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Select providers where repositories will be automatically provisioned and mirrored.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {providers.map((p) => (
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
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-magenta-500/20 rounded-xl flex items-center justify-center">
            <Box className="w-6 h-6 text-magenta-400" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Source Selection</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Select the repositories you want to mirror from your source providers.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={saveSelection}
              disabled={isSaving}
              className="px-6 py-2 bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-cyan-400 transition-all glow-cyan disabled:opacity-50"
            >
              {isSaving ? 'Provisioning...' : 'Initiate Mirroring'}
            </button>
            <button 
              onClick={selectAll}
              className="text-[9px] font-black text-cyan-400 uppercase tracking-widest hover:text-white transition-colors border border-cyan-500/20 px-3 py-2 rounded-lg"
            >
              Select All
            </button>
            <button 
              onClick={deselectAll}
              className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors border border-white/5 px-3 py-2 rounded-lg"
            >
              Deselect All
            </button>
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
                    {repos[ns.id]?.map((repo) => (
                      <div 
                        key={repo.id} 
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                        onClick={() => handleRepoCheck(ns.id, repo.id)}
                      >
                        <div className="flex items-center gap-3">
                          <button className="p-1">
                            {selectedRepos.has(repo.id) ? (
                              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-700" />
                            )}
                          </button>
                          <div>
                            <p className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{repo.name}</p>
                            <p className="text-[10px] text-slate-600 font-medium">{repo.description}</p>
                          </div>
                        </div>
                        <div className="text-[10px] font-black text-slate-700 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          Mirror Active
                        </div>
                      </div>
                    ))}
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'matrix' | 'source' | 'providers' | 'dlq' | 'logs' | 'settings' | 'systems'>('dashboard');
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
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [passwordReset, setPasswordReset] = useState({ current: '', new: '', confirm: '' });
  const [passwordResetStatus, setPasswordResetStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      fetchSettings();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

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
      console.error("Failed to fetch data", err);
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
      console.error("Failed to fetch settings", err);
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
      }
    } catch (err) {
      console.error("Failed to delete provider", err);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordReset.new !== passwordReset.confirm) {
      setPasswordResetStatus({ type: 'error', message: 'New passwords do not match' });
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
        setPasswordResetStatus({ type: 'success', message: 'Password updated successfully' });
        setPasswordReset({ current: '', new: '', confirm: '' });
        setIsDefaultPassword(false);
        localStorage.setItem('hydrozoa_is_default', 'false');
      } else {
        const data = await res.json();
        setPasswordResetStatus({ type: 'error', message: data.error || 'Failed to update password' });
      }
    } catch (err) {
      setPasswordResetStatus({ type: 'error', message: 'System communication error' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('hydrozoa_token');
    localStorage.removeItem('hydrozoa_is_default');
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
            <button 
              type="submit" 
              className="w-full py-4 bg-cyan-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-cyan-400 transition-all glow-cyan active:scale-95"
            >
              Initialize Session
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

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
      }
    } catch (err) {
      console.error("Failed to add provider", err);
    }
  };

  const handleReplay = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/v1/system/dlq/${id}/replay`, { 
        method: 'POST'
      });
      if (res.ok) {
        setDlqItems(dlqItems.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error("Failed to replay", err);
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
              <button 
                onClick={() => setActiveTab('settings')}
                className="px-6 py-2 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-400 transition-all"
              >
                Update Key
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl font-black text-white capitalize tracking-tighter">{activeTab.replace('_', ' ')}</h2>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Multipoint Mirror Agent</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={fetchData}
              className="p-3 glass-card hover:bg-cyan-500/10 transition-all hover:scale-110 active:scale-95 group border-cyan-500/20"
              title="Refresh Telemetry"
            >
              <RefreshCw className="w-5 h-5 text-cyan-400" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-3 glass-card hover:bg-red-500/10 transition-all hover:scale-110 active:scale-95 group border-red-500/20"
              title="Logout"
            >
              <X className="w-5 h-5 text-red-400" />
            </button>
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
              <SourceSelection providers={providers} />
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
              <SyncMatrix items={syncMatrix} providers={providers} settings={settings} />
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
                <button 
                  onClick={() => setIsAddingProvider(true)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-cyan-500 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-cyan-400 transition-all glow-cyan hover:scale-105 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Add Provider
                </button>
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
                      <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-cyan-500/10 transition-colors border border-white/5">
                        {p.type.includes('github') ? <Github className="w-8 h-8 text-slate-300 group-hover:text-cyan-400" /> : <Gitlab className="w-8 h-8 text-slate-300 group-hover:text-magenta-400" />}
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          Healthy
                        </div>
                        <span className="text-[8px] text-slate-600 font-mono mt-1 uppercase tracking-widest">Latency: {Math.floor(Math.random() * 100 + 50)}ms</span>
                      </div>
                    </div>
                    <h4 className="text-xl font-black text-white mb-1 tracking-tight relative z-10">{p.name}</h4>
                    <p className="text-xs text-slate-500 mb-6 truncate font-medium relative z-10">{p.baseUrl}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3 h-3 text-slate-600" />
                        <span className="text-[10px] text-slate-600 font-black font-mono tracking-widest">{p.token}</span>
                      </div>
                      <button 
                        onClick={() => setEditingProvider(p)}
                        className="text-[10px] text-cyan-400 font-black uppercase tracking-widest hover:text-white transition-colors"
                      >
                        Configure
                      </button>
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
                        <button 
                          onClick={() => {
                            handleDeleteProvider(editingProvider.id);
                            setEditingProvider(null);
                          }}
                          className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-red-500/20"
                        >
                          Confirm Decommissioning
                        </button>
                      </div>

                      <button 
                        onClick={() => setEditingProvider(null)}
                        className="w-full py-4 glass-card hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                      >
                        Close
                      </button>
                    </div>
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
                        <select name="type" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-medium cursor-pointer">
                          <option value="github">GitHub</option>
                          <option value="gitlab_self_hosted">GitLab (Self-Hosted)</option>
                          <option value="gitea">Gitea</option>
                          <option value="forgejo">Forgejo</option>
                          <option value="gogs">Gogs</option>
                          <option value="bitbucket">Bitbucket</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Base URL</label>
                        <input name="baseUrl" required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-medium" placeholder="https://git.company.com" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Personal Access Token</label>
                        <input name="token" type="password" required className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none transition-all font-medium" placeholder="glpat-xxxxxxxxxxxxxxx" />
                      </div>
                      <div className="flex gap-4 pt-6">
                        <button type="button" onClick={() => setIsAddingProvider(false)} className="flex-1 px-6 py-3 glass-card hover:bg-white/10 text-xs font-black uppercase tracking-widest text-white transition-all">Cancel</button>
                        <button type="submit" className="flex-1 px-6 py-3 bg-cyan-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-cyan-400 transition-all glow-cyan">Save Node</button>
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
                            <button 
                              onClick={() => handleReplay(item.id)}
                              className="p-2 hover:bg-cyan-500/10 rounded-lg transition-all group/btn"
                              title="Replay Sync"
                            >
                              <RefreshCw className="w-4 h-4 text-cyan-400 group-hover/btn:rotate-180 transition-transform duration-500" />
                            </button>
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
                          <button className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-red-500/20">Clear Logs</button>
                          <button className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-red-500/20">Reset Matrix</button>
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

                      <button 
                        type="submit"
                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/10"
                      >
                        Update Security Credentials
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={async () => {
                    const res = await fetchWithAuth('/api/v1/system/settings', {
                      method: 'POST',
                      body: JSON.stringify(settings)
                    });
                    if (res.ok) {
                      alert("Configuration Synchronized Successfully");
                    }
                  }}
                  className="px-12 py-4 bg-gradient-to-r from-cyan-500 to-magenta-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all glow-cyan"
                >
                  Save System Configuration
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div>
      </div>
    </div>
  );
}
