import { useEffect, useRef, useCallback } from 'react';
import { NetworkMessage } from '../types.ts';

// We use a unique prefix to avoid topic collisions on the public ntfy.sh server
const TOPIC_PREFIX = 'gemini_impostor_game_v2_';

export const useGameNetwork = (
  roomCode: string | null,
  onMessage: (msg: NetworkMessage) => void
) => {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!roomCode) return;

    const topic = `${TOPIC_PREFIX}${roomCode}`;
    const url = `https://ntfy.sh/${topic}/sse`;
    
    console.log(`📡 Connecting to cross-device topic: ${topic}`);
    
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const ntfyData = JSON.parse(event.data);
        // ntfy.sh sends the payload in the 'message' field
        if (ntfyData.message) {
          const gameMsg = JSON.parse(ntfyData.message) as NetworkMessage;
          onMessageRef.current(gameMsg);
        }
      } catch (e) {
        // Ignore non-json or malformed messages
      }
    };

    eventSource.onerror = () => {
      console.error("EventSource connection lost. Retrying...");
    };

    return () => {
      eventSource.close();
    };
  }, [roomCode]);

  const sendMessage = useCallback(async (msg: NetworkMessage) => {
    // We determine the room code from the message payload if possible, or use the provided one
    let targetCode = '';
    if (msg.type === 'JOIN_REQUEST') targetCode = msg.payload.roomCode;
    else if (msg.type === 'STATE_UPDATE') targetCode = msg.payload.roomCode;
    else if (roomCode) targetCode = roomCode;

    if (!targetCode) return;

    const topic = `${TOPIC_PREFIX}${targetCode}`;
    
    try {
      await fetch(`https://ntfy.sh/${topic}`, {
        method: 'POST',
        body: JSON.stringify(msg),
        headers: {
          'Title': 'Game Update',
          'Tags': 'video_game'
        }
      });
    } catch (e) {
      console.error("Failed to send message over network", e);
    }
  }, [roomCode]);

  return { sendMessage };
};