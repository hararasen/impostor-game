import { useEffect, useRef, useCallback } from 'react';
import { NetworkMessage } from '../types.ts';

const CHANNEL_NAME = 'impostor_game_v1';

export const useGameNetwork = (
  onMessage: (msg: NetworkMessage) => void
) => {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onMessageRef = useRef(onMessage);
  
  // Always keep the ref up to date with the latest callback
  onMessageRef.current = onMessage;

  useEffect(() => {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = bc;

    const listener = (event: MessageEvent) => {
      // Don't process messages sent by ourselves if BroadcastChannel did that (usually it doesn't)
      onMessageRef.current(event.data as NetworkMessage);
    };

    bc.addEventListener('message', listener);

    return () => {
      bc.removeEventListener('message', listener);
      bc.close();
    };
  }, []);

  const sendMessage = useCallback((msg: NetworkMessage) => {
    if (channelRef.current) {
      channelRef.current.postMessage(msg);
    }
  }, []);

  return { sendMessage };
};