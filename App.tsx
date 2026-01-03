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
  AlertTriangle,
  ShieldAlert,
  Settings,
  Wifi,
  Globe
} from 'lucide-react';

const generateRoomCode = () => Math.floor(100 + Math.random() * 900).toString();
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

  // Refs to avoid dependency loops in message handlers
  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;

  // Determine if I am currently the host
  const me = gameState?.players.find(p => p.id === userId);
  const isHost = me?.isHost || false;

  const handleMessage = useCallback((msg: NetworkMessage) => {
    const currentState = gameStateRef.current;

    // Filter out our own messages (mostly relevant for STATE_UPDATE)
    // Actually, receiving our own message can serve as a confirmation, 
    // but usually we want to avoid redundant state sets.

    if (msg.type === 'JOIN_REQUEST') {
      // ONLY the host handles join requests
      const amIHost = currentState?.players.find(p => p.id === userId)?.isHost;
      
      if (amIHost && currentState.roomCode === msg.payload.roomCode) {
        // Prevent duplicate entries
        if (currentState.players.some(p => p.id === msg.payload.playerId)) return;

        const newPlayer: Player = {
          id: msg.payload.playerId,
          name: msg.payload.name,
          isHost: false
        };
        
        setGameState({ ...currentState, players: [...currentState.players, newPlayer] });
      }
    } else if (msg.type === 'STATE_UPDATE') {
      // Host is source of truth, never adopt state from others
      const amIHost = currentState?.players.find(p => p.id === userId)?.isHost;
      if (amIHost) return;

      if (msg.payload.roomCode === activeRoomCode) {
        setGameState(msg.payload);
        
        // Auto-navigate views based on remote status
        if (msg.payload.status === GameStatus.PLAYING) setView('GAME');
        else if (msg.payload.status === GameStatus.LOBBY) setView('LOBBY');
      }
    } else if (msg.type === 'RESET_GAME') {
      const amIHost = currentState?.players.find(p => p.id === userId)?.isHost;
      if (!amIHost && currentState?.roomCode === activeRoomCode) {
        setView('LOBBY');
        setIsRevealed(false);
      }
    }
  }, [userId, activeRoomCode]);

  // Hook into the cross-device network
  const { sendMessage } = useGameNetwork(activeRoomCode, handleMessage);

  // --- NETWORK SYNC ---

  // Host broadcasts state changes to the web topic
  useEffect(() => {
    if (isHost && gameState) {
      sendMessage({ type: 'STATE_UPDATE', payload: gameState });
    }
  }, [gameState, isHost, sendMessage]);

  // Joiners periodically ping the host until they are accepted
  useEffect(() => {
    if (view === 'LOBBY' && !isHost && activeRoomCode) {
      const isInList = gameState?.players.some(p => p.id === userId);
      if (!isInList) {
        const interval = setInterval(() => {
          sendMessage({ 
            type: 'JOIN_REQUEST', 
            payload: { name: userName, roomCode: activeRoomCode, playerId: userId } 
          });
        }, 2000);
        return () => clearInterval(interval);
      }
    }
  }, [view, isHost, gameState, activeRoomCode, userName, userId, sendMessage]);

  // --- ACTIONS ---

  const createGame = () => {
    if (!userName.trim()) return setError("Please enter your name");
    setError(null);
    const code = generateRoomCode();
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
    if (!userName.trim() || !inputCode.trim()) return setError("Name and Room Code are required");
    setError(null);
    setActiveRoomCode(inputCode);
    sendMessage({ 
      type: 'JOIN_REQUEST', 
      payload: { name: userName, roomCode: inputCode, playerId: userId } 
    });
    setView('LOBBY');
  };

  const startGame = async () => {
    if (!gameState || !isHost) return;
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
      setView('GAME');
    } catch (e) {
      setError("Failed to start game. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetGame = () => {
    if (!gameState || !isHost) return;
    const lobbyState: GameState = { 
      ...gameState, 
      status: GameStatus.LOBBY, 
      roundData: undefined, 
      players: gameState.players.map(p => ({...p, role: undefined})) 
    };
    sendMessage({ type: 'RESET_GAME', payload: null });
    setGameState(lobbyState);
    setView('LOBBY');
    setIsRevealed(false);
  };

  // --- RENDERERS ---

  if (view === 'LANDING') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 animate-in fade-in duration-500">
          <div className="text-center space-y-2">
            <h1 className="text-6xl font-black bg-gradient-to-br from-cyan-400 via-purple-500 to-rose-500 bg-clip-text text-transparent tracking-tighter">IMPOSTOR</h1>
            <p className="text-slate-400 font-medium">Multiplayer Cross-Device Game</p>
          </div>
          <Card>
            <div className="space-y-6">
              <Input label="Nickname" placeholder="What should we call you?" value={userName} onChange={(e) => setUserName(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                 <Button onClick={createGame} className="w-full flex-col py-6 gap-2">
                    <Crown className="w-6 h-6 text-amber-400" />
                    <span>Host Game</span>
                 </Button>
                 <div className="space-y-2">
                    <Input placeholder="Code" className="text-center font-mono" maxLength={3} value={inputCode} onChange={(e) => setInputCode(e.target.value)} />
                    <Button variant="secondary" onClick={joinGame} className="w-full">Join Room</Button>
                 </div>
              </div>
            </div>
          </Card>
          {error && <div className="text-rose-400 text-center text-sm bg-rose-950/30 p-3 rounded-xl border border-rose-900/50">{error}</div>}
          
          <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 flex gap-3 items-center">
            <Globe className="w-5 h-5 text-cyan-500 shrink-0" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black leading-tight">
              Cross-Device Play Enabled via Global Network. Both players need internet access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'LOBBY') {
    const displayCode = activeRoomCode;
    const playerCount = gameState?.players.length || 0;
    const amIInList = gameState?.players.some(p => p.id === userId);

    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center">
        <div className="max-w-2xl w-full space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <div className="flex items-end justify-between border-b border-slate-800 pb-6">
              <div className="space-y-1">
                  <div className="flex items-center gap-2 text-cyan-500/80">
                    <Wifi className="w-3 h-3 animate-pulse" />
                    <h2 className="text-xs font-black uppercase tracking-[0.2em]">Room Code</h2>
                  </div>
                  <div className="text-6xl font-mono font-black text-cyan-400 leading-none drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]">{displayCode}</div>
              </div>
              <div className="text-right">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-[0.2em]">Players Connected</div>
                  <div className="text-4xl font-black text-slate-300 leading-none">{playerCount}</div>
              </div>
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gameState?.players.map(player => (
                  <div key={player.id} className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl flex items-center gap-4 shadow-lg animate-in fade-in scale-95">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-inner ${player.isHost ? 'bg-amber-500 text-amber-950' : 'bg-slate-700 text-slate-300'}`}>
                          {player.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="font-bold truncate text-lg">{player.name} {player.id === userId && <span className="text-cyan-500 font-normal text-xs">(You)</span>}</div>
                          {player.isHost && <div className="text-xs text-amber-500 font-bold flex items-center gap-1 uppercase tracking-wider"><Crown className="w-3 h-3"/> Room Host</div>}
                      </div>
                  </div>
              ))}
              {!amIInList && (
                <div className="col-span-full py-12 flex flex-col items-center gap-4 bg-slate-800/20 border-2 border-dashed border-slate-700 rounded-3xl animate-pulse">
                  <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Searching Global Lobby {displayCode}...</p>
                </div>
              )}
           </div>

           {isHost ? (
               <Card className="space-y-6 border-cyan-500/20 bg-cyan-500/5">
                   <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                       <div className="flex items-center gap-3">
                         <div className="p-2 bg-cyan-500/10 rounded-lg"><Settings className="w-5 h-5 text-cyan-500" /></div>
                         <span className="font-bold text-slate-200">Total Impostors</span>
                       </div>
                       <div className="flex items-center gap-6">
                           <button onClick={() => setGameState(prev => prev ? ({...prev, settings: {impostorCount: Math.max(1, prev.settings.impostorCount - 1)}}) : null)} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 font-black text-xl">-</button>
                           <span className="font-mono text-2xl font-black text-cyan-400">{gameState?.settings.impostorCount || 1}</span>
                           <button onClick={() => setGameState(prev => prev ? ({...prev, settings: {impostorCount: Math.min(Math.max(1, (gameState?.players.length || 1) - 1), prev.settings.impostorCount + 1)}}) : null)} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 font-black text-xl">+</button>
                       </div>
                   </div>
                   <Button onClick={startGame} isLoading={isLoading} disabled={(gameState?.players.length || 0) < 3} size="lg" className="w-full">
                        <Play className="w-5 h-5 fill-current" /> Start Game Session
                   </Button>
                   {(gameState?.players.length || 0) < 3 && <p className="text-center text-xs text-slate-500 font-medium italic">Waiting for 3+ players to start...</p>}
               </Card>
           ) : amIInList && (
             <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Successfully Connected!</p>
                  <p className="text-slate-600 text-[10px] font-bold mt-1 uppercase">Waiting for Host to start the round</p>
                </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  if (view === 'GAME' && gameState && me) {
      const isImpostor = me.role === 'impostor';
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center">
            <div className="w-full max-w-4xl p-4 flex justify-between items-center border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${isHost ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'}`} />
                    <span className="font-black text-sm tracking-tight">{me.name}</span>
                </div>
                {isHost && <Button variant="danger" size="sm" onClick={resetGame} className="px-4"><RefreshCw className="w-4 h-4" /> End Round</Button>}
            </div>

            <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-center p-6 space-y-12 animate-in fade-in zoom-in duration-500">
                <div className="text-center space-y-3">
                    <h2 className="text-slate-500 uppercase tracking-[0.3em] text-xs font-black">Current Category</h2>
                    <p className="text-4xl font-black text-cyan-400 drop-shadow-lg">{gameState.roundData?.category}</p>
                </div>

                <div className="w-full aspect-[4/5] relative">
                    <button 
                      onClick={() => setIsRevealed(!isRevealed)} 
                      className="w-full h-full relative group focus:outline-none perspective-1000"
                    >
                        {isRevealed ? (
                            <div className={`w-full h-full rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center gap-8 shadow-2xl border-4 transition-all duration-500 ${isImpostor ? 'bg-gradient-to-br from-rose-900 via-rose-950 to-black border-rose-500 shadow-rose-900/50' : 'bg-gradient-to-br from-cyan-900 via-cyan-950 to-black border-cyan-500 shadow-cyan-900/50'}`}>
                                {isImpostor ? (
                                    <>
                                        <div className="p-6 bg-rose-500/10 rounded-full animate-pulse"><ShieldAlert className="w-24 h-24 text-rose-500" /></div>
                                        <div className="space-y-2">
                                          <h3 className="text-5xl font-black text-rose-100 italic tracking-tighter uppercase leading-none">Impostor</h3>
                                          <p className="text-rose-400 font-bold text-sm uppercase tracking-widest mt-2">You don't know the word!</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-6 bg-cyan-500/10 rounded-full"><Users className="w-24 h-24 text-cyan-500" /></div>
                                        <div className="space-y-2">
                                          <h3 className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">The Secret Word</h3>
                                          <p className="text-5xl font-black text-white tracking-tight leading-none">{gameState.roundData?.topic}</p>
                                        </div>
                                    </>
                                )}
                                <div className="absolute bottom-10 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                    <EyeOff className="w-4 h-4" /> Tap to Hide Secret
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full bg-slate-800 rounded-[2.5rem] border-4 border-slate-700 flex flex-col items-center justify-center gap-6 transition-all hover:border-slate-500 hover:bg-slate-700/80 shadow-2xl group">
                                <div className="w-32 h-32 rounded-full bg-slate-900 flex items-center justify-center border-4 border-slate-800 shadow-inner group-hover:scale-110 transition-transform duration-300">
                                    <span className="text-6xl font-black text-slate-700">?</span>
                                </div>
                                <div className="text-center space-y-1">
                                  <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">Tap to Reveal</p>
                                  <p className="text-slate-600 text-[10px] uppercase font-bold">Keep it secret!</p>
                                </div>
                            </div>
                        )}
                    </button>
                </div>
                
                <div className="bg-slate-800/30 px-6 py-4 rounded-2xl border border-slate-700/50 text-center text-xs font-medium text-slate-500 max-w-xs leading-relaxed">
                    {isImpostor 
                      ? "Fake it! Ask questions about the category without revealing you're the impostor." 
                      : "Find the person who doesn't know the word. Don't be too obvious!"}
                </div>
            </div>
        </div>
      );
  }
  return null;
};

export default App;