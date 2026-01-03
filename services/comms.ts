
import { useEffect, useRef, useCallback } from 'react';
import { NetworkMessage } from '../types.ts';

const TOPIC_PREFIX = 'gemini_impostor_v4_';
const SESSION_ID = Math.random().toString(36).substring(2, 15);

export const useGameNetwork = (
  roomCode: string | null,
  onMessage: (msg: NetworkMessage) => void
) => {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!roomCode) return;

    const topic = `${TOPIC_PREFIX}${roomCode.toUpperCase()}`;
    const url = `https://ntfy.sh/${topic}/sse`;
    
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const ntfyData = JSON.parse(event.data);
        if (ntfyData.message) {
          const envelope = JSON.parse(ntfyData.message);
          if (envelope.senderId === SESSION_ID) return;
          onMessageRef.current(envelope.message as NetworkMessage);
        }
      } catch (e) {
        // Ignore noise
      }
    };

    return () => {
      eventSource.close();
    };
  }, [roomCode]);

  const sendMessage = useCallback(async (msg: NetworkMessage, targetCode?: string) => {
    const code = targetCode || roomCode;
    if (!code) return;

    const topic = `${TOPIC_PREFIX}${code.toUpperCase()}`;
    const payload = {
      senderId: SESSION_ID,
      message: msg
    };
    
    try {
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Broadcast failed", e);
    }
  }, [roomCode]);

  return { sendMessage };
};
