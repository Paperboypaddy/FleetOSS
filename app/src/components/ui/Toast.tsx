import { useEffect, useState } from 'react';

interface ToastProps {
  message: string | null;
  onDone: () => void;
}

export default function Toast({ message, onDone }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDone, 250);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [message, onDone]);

  return (
    <div
      className={`fixed bottom-5 right-5 bg-surface border border-green rounded-lg px-3.5 py-2.5 text-xs text-green font-mono pointer-events-none z-[100] transition-all duration-250 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-[60px] opacity-0'
      }`}
    >
      {message}
    </div>
  );
}
