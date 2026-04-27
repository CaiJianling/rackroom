import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface ToastContextType {
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300);
      }, toast.duration - 300);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.id, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-green-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertCircle className="h-5 w-5 text-yellow-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
    error: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-4 shadow-lg min-w-[300px] max-w-[500px]',
        'transition-all duration-300 ease-in-out',
        bgColors[toast.type],
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      )}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm font-medium text-foreground">{toast.message}</p>
      <button
        onClick={handleClose}
        className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
