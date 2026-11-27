import { useEffect, useRef, useSyncExternalStore } from 'react';
import { connect, disconnect, subscribe, getState } from '../socket';

// Держит WebSocket-соединение, пока есть токен. Возвращает { socket, status }.
export default function useSocket(token, onAuthLost) {
  const state = useSyncExternalStore(subscribe, getState);
  const authLostRef = useRef(onAuthLost);

  useEffect(() => {
    authLostRef.current = onAuthLost;
  }, [onAuthLost]);

  useEffect(() => {
    if (!token) return undefined;
    connect(token, () => authLostRef.current());
    return () => disconnect();
  }, [token]);

  return state;
}
