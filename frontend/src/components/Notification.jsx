import { useEffect } from 'react';

export default function Notification({ notice, onClose }) {
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [notice, onClose]);

  if (!notice) return null;

  return (
    <div className={`notice notice-${notice.type}`} role="alert">
      <span>{notice.text}</span>
      <button type="button" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
