
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, GameStatus, Player, NetworkMessage } from './types.ts';
import { useGameNetwork } from './services/comms.ts';
import { generateGameTopic } from './services/geminiService.ts';
import { Button } from './components/Button.tsx';
import { Input } from './components/Input.tsx';
import { Card } from './components/Card.tsx';
import { 
  Users, 
  Play, 
  RefreshCw, 
  EyeOff, 
  Crown, 
  Settings,
  Wifi,
  AlertCircle,
  CheckCircle2,
  Globe
} from 'lucide-react';

const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for(let i=0; i<4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
  return res;
};
const generateId = () => Math.random().toString(36).substring(2, 9);

const App: React.FC = () => {
  const [userId] = useState(generateId());
  const [userName, setUserName] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'LANDING' | 'LOBBY' | 'GAME'>('LANDING');
  const [isRevealed, setIsRevealed] = useState(false);

  // Source of truth for Host status
  const isHostLocal = useRef(false);

  // Computed state
  const me = gameState?.players.find(p => p.id === userId);

  const handleMessage = useCallback((msg: NetworkMessage) => {
    if (msg.type === 'JOIN_REQUEST') {
      if (!isHostLocal.current) return;
      
      setGameState(prev => {
        if (!prev || prev.roomCode !== msg.payload.roomCode) return prev;
        // Don't add if already exists
        if (prev.players.some(p => p.id === msg.payload.playerId)) return prev;
        
        const newPlayer: Player = { 
          id: msg.payload.playerId, 
          name: msg.payload.name, 
          isHost: false 
        };
        return { ...prev, players: [...prev.players, newPlayer] };
      });
    } else if (msg.type === 'STATE_UPDATE') {
      // Non-hosts adopt the host's state
      if (!isHostLocal.current && msg.payload.roomCode === activeRoomCode) {
        setGameState(msg.payload);
      }
    } else if (msg.type === 'RESET_GAME') {
      if (!isHostLocal.current) {
        setIsRevealed(false);
      }
    }
  }, [activeRoomCode]);

  const { sendMessage } = useGameNetwork(activeRoomCode, handleMessage);

  // --- VIEW SYNCHRONIZATION ---
  // This effect ensures joiners move between screens based on the game status
  useEffect(() => {
    if (!gameState) return;

    if (gameState.status === GameStatus.PLAYING) {
      if (view !== 'GAME') setView('GAME');
    } else if (gameState.status === GameStatus.LOBBY) {
      if (view === 'GAME') {
        setView('LOBBY');
        setIsRevealed(false);
      }
    }
  }, [gameState?.status, view]);

  // --- HOST BROADCASTING ---
  // Heartbeat: Host sends state every 2 seconds to keep everyone synced
  useEffect(() => {
    if (isHostLocal.current && gameState) {
      // Send immediately on any state change
      sendMessage({ type: 'STATE_UPDATE', payload: gameState });

      // And set up the fallback heartbeat
      const interval = setInterval(() => {
        sendMessage({ type: 'STATE_UPDATE', payload: gameState });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [gameState, sendMessage]);

  // --- JOINER HANDSHAKE ---
  // Keep requesting to join until the Host's state broadcast includes us
  useEffect(() => {
    if (view === 'LOBBY' && !isHostLocal.current && activeRoomCode) {
      const amIInList = gameState?.players.some(p => p.id === userId);
      if (!amIInList) {
        const interval = setInterval(() => {
          sendMessage({ 
            type: 'JOIN_REQUEST', 
            payload: { name: userName, roomCode: activeRoomCode, playerId: userId } 
          });
        }, 1500);
        return () => clearInterval(interval);
      }
    }
  }, [view, activeRoomCode, gameState?.players, userName, userId, sendMessage]);

  const createGame = () => {
    if (!userName.trim()) return setError("Please enter your name");
    setError(null);
    const code = generateRoomCode();
    isHostLocal.current = true;
    const newGameState: GameState = {
      roomCode: code,
      status: GameStatus.LOBBY,
      settings: { impostorCount: 1 },
      players: [{ id: userId, name: userName, isHost: true }]
    };
    setActiveRoomCode(code);
    setGameState(newGameState);
    setView('LOBBY');
  };

  const joinGame = () => {
    const code = inputCode.trim().toUpperCase();
    if (!userName.trim() || !code) return setError("Name and Room Code are required");
    setError(null);
    isHostLocal.current = false;
    setActiveRoomCode(code);
    setView('LOBBY');
    // Initial join attempt
    sendMessage({ 
      type: 'JOIN_REQUEST', 
      payload: { name: userName, roomCode: code, playerId: userId } 
    });
  };

  const startGame = async () => {
    if (!gameState || !isHostLocal.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const { category, topic } = await generateGameTopic();
      const impostorCount = gameState.settings.impostorCount;
      const shuffledIds = [...gameState.players].map(p => p.id).sort(() => 0.5 - Math.random());
      const selectedImpostors = shuffledIds.slice(0, impostorCount);
      
      const updatedPlayers = gameState.players.map(p => ({
        ...p,
        role: selectedImpostors.includes(p.id) ? 'impostor' : 'innocent'
      })) as Player[];

      const newState: GameState = { 
        ...gameState, 
        status: GameStatus.PLAYING, 
        players: updatedPlayers, 
        roundData: { category, topic } 
      };
      
      setGameState(newState);
      sendMessage({ type: 'STATE_UPDATE', payload: newState });
      setView('GAME');
    } catch (e) {
      setError("AI Topic service is busy. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetGame = () => {
    if (!gameState || !isHostLocal.current) return;
    const lobbyState: GameState = { 
      ...gameState, 
      status: GameStatus.LOBBY, 
      roundData: undefined, 
      players: gameState.players.map(p => ({...p, role: undefined})) 
    };
    setGameState(lobbyState);
    sendMessage({ type: 'STATE_UPDATE', payload: lobbyState });
    setView('LOBBY');
    setIsRevealed(false);
  };

  if (view === 'LANDING') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 animate-in fade-in duration-500">
          <div className="text-center space-y-2">
            <h1 className="text-6xl font-black bg-gradient-to-br from-cyan-400 via-purple-500 to-rose-500 bg-clip-text text-transparent tracking-tighter">IMPOSTOR</h1>
            <p className="text-slate-400 font-medium text-sm tracking-widest uppercase font-bold">Multiplayer Social Deduction</p>
          </div>
          <Card>
            <div className="space-y-6">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              <Input label="Your Name" placeholder="Enter nickname" value={userName} onChange={(e) => setUserName(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                 <Button onClick={createGame} className="w-full flex-col py-6 gap-2">
                    <Crown className="w-6 h-6 text-amber-400" />
                    <span>Host Game</span>
                 </Button>
                 <div className="space-y-2">
                    <Input placeholder="Code" className="text-center font-mono uppercase" maxLength={4} value={inputCode} onChange={(e) => setInputCode(e.target.value)} />
                    <Button variant="secondary" onClick={joinGame} className="w-full">Join Room</Button>
                 </div>
              </div>
            </div>
          </Card>
          <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 flex gap-3 items-center">
            <Globe className="w-6 h-6 text-cyan-500 shrink-0" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black leading-tight">
              Instant Sync Active. All devices connected to global relay.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'LOBBY') {
    const amIInList = gameState?.players.some(p => p.id === userId);
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-xl w-full space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-end justify-between border-b border-slate-800 pb-6">
            <div className="space-y-1">
              <h2 className="text-xs font-black uppercase tracking-widest text-cyan-500 flex items-center gap-2">
                <Wifi className="w-3 h-3 animate-pulse" /> Room Code
              </h2>
              <div className="text-6xl font-black font-mono text-cyan-400 tracking-tighter uppercase">{activeRoomCode}</div>
            </div>
            <div className="text-right">
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Players</div>
              <div className="text-4xl font-black text-slate-300">{gameState?.players.length || 0}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            {gameState?.players.map(player => (
              <div key={player.id} className={`p-4 rounded-2xl flex items-center gap-4 border transition-all ${player.id === userId ? 'bg-slate-800 border-cyan-500/50 shadow-lg shadow-cyan-500/10' : 'bg-slate-800/50 border-slate-700'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${player.isHost ? 'bg-amber-500 text-amber-950' : 'bg-slate-700 text-slate-300'}`}>
                  {player.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate text-slate-200">{player.name} {player.id === userId && <span className="text-cyan-500 text-[10px] uppercase ml-1">(You)</span>}</div>
                  {player.isHost && <div className="text-[10px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-1"><Crown className="w-2.5 h-2.5"/> Host</div>}
                </div>
                {player.id === userId && <CheckCircle2 className="w-4 h-4 text-cyan-500" />}
              </div>
            ))}
            {!amIInList && (
               <div className="col-span-full py-10 flex flex-col items-center gap-3 bg-slate-800/20 border-2 border-dashed border-slate-700 rounded-3xl animate-pulse">
                  <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Awaiting Host Confirmation...</p>
               </div>
            )}
          </div>

          {isHostLocal.current ? (
            <Card className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-400 text-xs uppercase tracking-widest">Game Settings</span>
                <span className="text-cyan-400 font-black text-sm">{gameState?.settings.impostorCount} Impostor(s)</span>
              </div>
              <Button onClick={startGame} isLoading={isLoading} disabled={(gameState?.players.length || 0) < 2} className="w-full py-5">
                <Play className="w-5 h-5 fill-current" /> Start Mission
              </Button>
            </Card>
          ) : amIInList && (
            <div className="text-center py-6 bg-slate-800/30 rounded-3xl border border-slate-800">
               <p className="text-cyan-500 font-black uppercase tracking-[0.3em] text-xs">Waiting for Host...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'GAME' && gameState && me) {
    const isImpostor = me.role === 'impostor';
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4">
        <div className="w-full max-w-md flex justify-between items-center mb-12">
           <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full border border-slate-700">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isImpostor ? 'bg-rose-500' : 'bg-cyan-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">{me.name}</span>
           </div>
           {isHostLocal.current && <Button variant="ghost" size="sm" onClick={resetGame} className="text-[10px] uppercase font-black"><RefreshCw className="w-3 h-3" /> End Round</Button>}
        </div>

        <div className="max-w-md w-full flex-1 flex flex-col items-center justify-center space-y-10 animate-in zoom-in-95 duration-500">
          <div className="text-center space-y-2">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Mission Category</h2>
            <p className="text-4xl font-black text-white uppercase tracking-tight">{gameState.roundData?.category}</p>
          </div>

          <div className="w-full aspect-[4/5] relative">
            <button 
              onClick={() => setIsRevealed(!isRevealed)}
              className="w-full h-full relative group perspective-1000"
            >
              <div className={`w-full h-full rounded-[3rem] p-8 flex flex-col items-center justify-center text-center gap-6 border-4 transition-all duration-700 ${isRevealed ? (isImpostor ? 'bg-rose-950 border-rose-500' : 'bg-cyan-950 border-cyan-500') : 'bg-slate-800 border-slate-700'}`}>
                {isRevealed ? (
                  <>
                    <h3 className={`text-5xl font-black italic tracking-tighter ${isImpostor ? 'text-rose-500' : 'text-cyan-400'}`}>
                      {isImpostor ? 'IMPOSTOR' : 'INNOCENT'}
                    </h3>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Secret Word</p>
                      <p className="text-4xl font-black text-white uppercase">{isImpostor ? '???' : gameState.roundData?.topic}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-32 h-32 rounded-full bg-slate-900 flex items-center justify-center border-4 border-slate-700 group-hover:scale-105 transition-transform">
                      <span className="text-6xl font-black text-slate-600">?</span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Tap to Reveal</p>
                  </>
                )}
              </div>
            </button>
          </div>

          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-center px-8">
            {isImpostor ? "Find the word by listening to clues." : "Give clues without revealing the word."}
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
