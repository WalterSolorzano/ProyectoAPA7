import React, { useEffect, useState } from 'react';
import { Activity, Server } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AIHealthStatus = 'good' | 'warning' | 'critical';

interface SpecialtyHealth {
  provider: string;
  percentage: number;
  status: AIHealthStatus;
}

interface AIHealthResponse {
  [specialty: string]: SpecialtyHealth;
}

const SignalBars = ({ percentage, status, className }: { percentage: number, status: AIHealthStatus, className?: string }) => {
  // Calculamos cuantas barras encender (0 a 4)
  const activeBars = Math.ceil((percentage / 100) * 4);
  
  const getColor = (isActive: boolean, stat: AIHealthStatus) => {
    if (!isActive) return 'bg-slate-700/50'; // Barra apagada
    if (stat === 'critical') return 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]';
    if (stat === 'warning') return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]';
    return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
  };

  return (
    <div className={cn("flex items-end gap-[2px] h-4", className)}>
      {[1, 2, 3, 4].map((bar) => (
        <div
          key={bar}
          className={cn(
            "w-1.5 rounded-sm transition-all duration-500",
            getColor(bar <= activeBars, status),
            bar === 1 ? 'h-1.5' : bar === 2 ? 'h-2.5' : bar === 3 ? 'h-3.5' : 'h-full'
          )}
        />
      ))}
    </div>
  );
};

export const AIBatteryIndicator: React.FC = () => {
  const [health, setHealth] = useState<AIHealthResponse | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/ai/health');
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        }
      } catch (err) {
        console.error("No se pudo obtener el estado de IA");
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // Polling cada 15s
    return () => clearInterval(interval);
  }, []);

  if (!health) return null;

  // Calculamos el estado global (el peor de todos)
  const specialties = Object.values(health);
  const isCritical = specialties.some(s => s.status === 'critical');
  const isWarning = specialties.some(s => s.status === 'warning');
  
  const globalStatus = isCritical ? 'critical' : (isWarning ? 'warning' : 'good');

  return (
    <div 
      className="fixed bottom-4 left-4 z-[9999] flex items-end"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Panel Detallado (Hover) */}
      <div 
        className={cn(
          "absolute bottom-full left-0 mb-3 w-64 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3 shadow-2xl shadow-black/50 transition-all duration-300 origin-bottom-left",
          isHovered ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2 mb-3 border-b border-slate-700/50 pb-2">
          <Server className="w-4 h-4 text-slate-400" />
          <h4 className="text-xs font-semibold text-slate-200 tracking-wider uppercase">Estado de Red IA</h4>
        </div>
        
        <div className="space-y-3">
          {Object.entries(health).map(([specialty, data]) => (
            <div key={specialty} className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-300">
                  {specialty === 'FAST' ? 'Corrector Rapido' : specialty === 'HEAVY' ? 'Analizador Profundo' : 'Motor Lógico'}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">{data.provider}</p>
              </div>
              <SignalBars percentage={data.percentage} status={data.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Ícono Principal */}
      <div 
        className={cn(
          "relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 border border-slate-700 shadow-lg cursor-pointer transition-transform hover:scale-105",
          globalStatus === 'critical' ? 'shadow-[0_0_15px_rgba(239,68,68,0.3)] border-red-900/50' : 
          globalStatus === 'warning' ? 'shadow-[0_0_15px_rgba(251,191,36,0.2)]' : 'shadow-black/20'
        )}
      >
        {globalStatus === 'critical' && (
          <div className="absolute inset-0 rounded-full animate-ping bg-red-500/20" style={{ animationDuration: '3s' }} />
        )}
        <Activity 
          className={cn(
            "w-5 h-5 transition-colors duration-500",
            globalStatus === 'critical' ? 'text-red-500 animate-pulse' : 
            globalStatus === 'warning' ? 'text-amber-400' : 'text-emerald-400'
          )} 
        />
      </div>
    </div>
  );
};
