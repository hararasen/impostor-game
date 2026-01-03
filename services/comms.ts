import { useEffect, useRef, useCallback } from 'react';
import { NetworkMessage } from '../types.ts';

const CHANNEL_NAME = 'impostor_game_channel_v1';

export const useGameNetwork = (
  onMessage: (msg: NetworkMessage) => void
) => {
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Use a stable reference to the message handler
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = bc;

    const listener = (event: MessageEvent) => {
      onMessageRef.current(event.data as NetworkMessage);
    };

    bc.addEventListener('message', listener);

    return () => {
      bc.removeEventListener('message', listener);
      bc.close();
    };
  }, []);

  const sendMessage = useCallback((msg: NetworkMessage) => {
    channelRef.current?.postMessage(msg);
  }, []);

  return { sendMessage };
};