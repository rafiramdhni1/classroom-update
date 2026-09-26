import React, { useEffect, useState, useCallback } from 'react';

const listeners = new Set();

function emit(toast) {
  listeners.forEach(fn => fn(toast));
}

function guid() {
  return Math.random().toString(36).slice(2, 10);
}

const toast = {
  success(message) {
    emit({ id: guid(), type: 'success', message });
  },
  error(message) {
    emit({ id: guid(), type: 'error', message });
  },
  info(message) {
    emit({ id: guid(), type: 'info', message });
  },
};

const styles = {
  success: {
    container: 'border-green-500',
    iconBg: 'bg-green-100 text-green-600',
    bar: 'bg-green-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    container: 'border-red-500',
    iconBg: 'bg-red-100 text-red-600',
    bar: 'bg-red-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
  },
  info: {
    container: 'border-blue-500',
    iconBg: 'bg-blue-100 text-blue-600',
    bar: 'bg-blue-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  },
};

function ToastItem({ item, onClose }) {
  const s = styles[item.type] || styles.info;
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`relative overflow-hidden flex items-start gap-3 pl-4 pr-3 py-3 bg-white rounded-xl shadow-lg border-l-4 ${s.container} transform transition-all duration-300 animate-[slideIn_.3s_ease-out]`}>
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${s.iconBg}`}>{s.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">
          {item.type === 'success' ? 'Berhasil' : item.type === 'error' ? 'Gagal' : 'Info'}
        </p>
        <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-line break-words">{item.message}</p>
      </div>
      <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Tutup">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className={`absolute bottom-0 left-0 h-1 ${s.bar} toast-progress`} />
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const fn = item => setToasts(prev => [...prev.slice(-4), item]);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-[9999] w-[calc(100%-2rem)] sm:w-96 space-y-3">
      {toasts.map(t => (
        <ToastItem key={t.id} item={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
}

export default toast;