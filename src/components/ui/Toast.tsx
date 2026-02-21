// FR-UX: Toast Notification System
// Clean toast notifications for user feedback

import { useState, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { ...toast, id }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 3000);
  }, []);

  // Listen for custom toast events
  useEffect(() => {
    const handleToast = (e: CustomEvent) => {
      addToast(e.detail);
    };

    window.addEventListener('toast' as any, handleToast);
    return () => window.removeEventListener('toast' as any, handleToast);
  }, [addToast]);

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'px-4 py-3 rounded-lg shadow-md bg-white dark:bg-gray-800 border animate-in slide-in-from-right-full',
            toast.type === 'success' && 'border-green-500',
            toast.type === 'error' && 'border-red-500',
            toast.type === 'info' && 'border-blue-500'
          )}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
            {toast.type === 'error' && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
            {toast.type === 'info' && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{toast.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Export singleton toast API
export const toast = {
  success: (message: string) =>
    window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message } })),
  error: (message: string) =>
    window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message } })),
  info: (message: string) =>
    window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'info', message } })),
};
