import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  showError: (message: string, err?: any) => void;
  showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({} as ToastContextType);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 6000) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const showSuccess = useCallback((message: string) => {
    showToast(message, 'success');
  }, [showToast]);

  const showError = useCallback((message: string, err?: any) => {
    let finalMessage = message;
    if (err) {
      const errMsg = err.message || (typeof err === 'string' ? err : '');
      if (errMsg) {
        finalMessage = `${message}: ${errMsg}`;
      }
    }
    showToast(finalMessage, 'error');
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, showError, showSuccess }}>
      {children}
      
      {/* Toast Portal Container */}
      <div 
        className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-2.5 max-w-md w-full px-4 sm:px-0 pointer-events-none"
        id="global-toast-container"
      >
        {toasts.map((toast) => {
          let bgColor = 'bg-white dark:bg-slate-900';
          let borderColor = 'border-slate-200 dark:border-slate-800';
          let textColor = 'text-slate-800 dark:text-slate-200';
          let Icon = Info;
          let iconColor = 'text-blue-500';

          if (toast.type === 'success') {
            bgColor = 'bg-emerald-50/95 dark:bg-emerald-950/90';
            borderColor = 'border-emerald-200 dark:border-emerald-900/50';
            textColor = 'text-emerald-900 dark:text-emerald-200';
            Icon = CheckCircle2;
            iconColor = 'text-emerald-500';
          } else if (toast.type === 'error') {
            bgColor = 'bg-rose-50/95 dark:bg-rose-950/90';
            borderColor = 'border-rose-200 dark:border-rose-900/50';
            textColor = 'text-rose-900 dark:text-rose-200';
            Icon = AlertCircle;
            iconColor = 'text-rose-500';
          } else if (toast.type === 'warning') {
            bgColor = 'bg-amber-50/95 dark:bg-amber-950/90';
            borderColor = 'border-amber-200 dark:border-amber-900/50';
            textColor = 'text-amber-900 dark:text-amber-200';
            Icon = AlertTriangle;
            iconColor = 'text-amber-500';
          } else {
            bgColor = 'bg-slate-50/95 dark:bg-slate-900/90';
            borderColor = 'border-indigo-100 dark:border-indigo-950/50';
            textColor = 'text-indigo-950 dark:text-indigo-200';
            Icon = Info;
            iconColor = 'text-indigo-500';
          }

          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-sm pointer-events-auto transition-all duration-350 transform translate-y-0 scale-100 animate-slide-in-up ${bgColor} ${borderColor} ${textColor}`}
              id={`toast-${toast.id}`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 text-xs font-medium leading-relaxed break-words">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
