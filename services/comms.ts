import { useEffect, useRef, useCallback } from 'react';
import { NetworkMessage } from '../types.ts';

const TOPIC_PREFIX = 'gemini_impostor_v3_';
// Create a unique ID for this specific tab session to ignore our own echoes
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
    
    console.log(`📡 Listening on: ${topic}`);
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const ntfyData = JSON.parse(event.data);
        if (ntfyData.message) {
          const envelope = JSON.parse(ntfyData.message);
          
          // Ignore messages sent by THIS specific tab
          if (envelope.senderId === SESSION_ID) return;
          
          onMessageRef.current(envelope.message as NetworkMessage);
        }
      } catch (e) {
        // Silently ignore malformed network noise
      }
    };

    eventSource.onerror = () => {
      console.warn("Connection dropped, reconnecting...");
    };

    return () => {
      eventSource.close();
    };
  }, [roomCode]);

  const sendMessage = useCallback(async (msg: NetworkMessage) => {
    let targetCode = '';
    if (msg.type === 'JOIN_REQUEST') targetCode = msg.payload.roomCode;
    else if (msg.type === 'STATE_UPDATE') targetCode = msg.payload.roomCode;
    else if (roomCode) targetCode = roomCode;

    if (!targetCode) return;

    const topic = `${TOPIC_PREFIX}${targetCode.toUpperCase()}`;
    const payload = {
      senderId: SESSION_ID,
      message: msg
    };
    
    try {
      // Use no-cors or standard fetch for ntfy POST
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Network broadcast failed", e);
    }
  }, [roomCode]);

  return { sendMessage };
};