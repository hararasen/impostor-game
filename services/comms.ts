import { useEffect, useRef } from 'react';
import { NetworkMessage } from '../types.ts';

const CHANNEL_NAME = 'impostor_game_channel_v1';

export const useGameNetwork = (
  onMessage: (msg: NetworkMessage) => void
) => {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = bc;

    const handleMessage = (event: MessageEvent) => {
      onMessage(event.data as NetworkMessage);
    };

    bc.addEventListener('message', handleMessage);

    return () => {
      bc.removeEventListener('message', handleMessage);
      bc.close();
    };
  }, [onMessage]);

  const sendMessage = (msg: NetworkMessage) => {
    channelRef.current?.postMessage(msg);
  };

  return { sendMessage };
};