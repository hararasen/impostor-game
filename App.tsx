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
  ShieldAlert,
  Settings,
  Wifi,
  Globe,
  CheckCircle2,
  AlertCircle
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

  // Determine role and status locally
  const me = gameState?.players.find(p => p.id === userId);
  const isHost = me?.isHost || false;

  const handleMessage = useCallback((msg: NetworkMessage) => {
    if (msg.type === 'JOIN_REQUEST') {
      setGameState(prev => {
        if (!prev) return null;
        const amIHost = prev.players.find(p => p.id === userId)?.isHost;
        if (amIHost && prev.roomCode === msg.payload.roomCode) {
          // If they are already in the list, just return prev
          if (prev.players.some(p => p.id === msg.payload.playerId)) return prev;
          
          const newPlayer: Player = { id: msg.payload.playerId, name: msg.payload.name, isHost: false };
          return { ...prev, players: [...prev.players, newPlayer] };
        }
        return prev;
      });
    } else if (msg.type === 'STATE_UPDATE') {
      setGameState(prev => {
        const amIHost = prev?.players.find(p => p.id === userId)?.isHost;
        // Host is the source of truth, never overwrite its state from network
        if (amIHost) return prev; 
        
        if (msg.payload.roomCode === activeRoomCode) {
          return msg.payload;
        }
        return prev;
      });
    } else if (msg.type === 'RESET_GAME') {
      setGameState(prev => {
        if (!prev) return null;
        return { ...prev, status: GameStatus.LOBBY, roundData: undefined };
      });
      setIsRevealed(false);
    }
  }, [userId, activeRoomCode]);

  const { sendMessage } = useGameNetwork(activeRoomCode, handleMessage);

  // --- VIEW SYNC ---
  useEffect(() => {
    if (gameState) {
      if (gameState.status === GameStatus.PLAYING && view !== 'GAME') setView('GAME');
      if (gameState.status === GameStatus.LOBBY && view !== 'LOBBY' && view !== 'LANDING') setView('LOBBY');
    }
  }, [gameState, view]);

  // --- HOST HEARTBEAT ---
  // If I'm the host, broadcast the state every 2 seconds to keep everyone synced
  useEffect(() => {
    if (isHost && gameState) {
      const interval = setInterval(() => {
        sendMessage({ type: 'STATE_UPDATE', payload: gameState });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isHost, gameState, sendMessage]);

  // --- JOINING LOOP ---
  // If I'm trying to join, keep sending my info until I see myself in the list
  useEffect(() => {
    if (view === 'LOBBY' && !isHost && activeRoomCode) {
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
  }, [view, isHost, gameState, activeRoomCode, userName, userId, sendMessage]);

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
    const code = inputCode.trim().toUpperCase();
    if (!userName.trim() || !code) return setError("Name and Room Code are required");
    setError(null);
    setActiveRoomCode(code);
    setView('LOBBY');
    // Initial join attempt
    sendMessage({ 
      type: 'JOIN_REQUEST', 
      payload: { name: userName, roomCode: code, playerId: userId } 
    });
  };

  const startGame = async () => {
    if (!gameState || !isHost) return;
    setIsLoading(true);
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
    } catch (e) {
      setError("Failed to generate mission. Check connection.");
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
    setGameState(lobbyState);
    sendMessage({ type: 'RESET_GAME', payload: null });
    // Heartbeat will handle the rest
    setIsRevealed(false);
  };

  if (view === 'LANDING') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-2">
            <h1 className="text-6xl font-black bg-gradient-to-br from-cyan-400 via-purple-500 to-rose-500 bg-clip-text text-transparent tracking-tighter">IMPOSTOR</h1>
            <p className="text-slate-400 font-medium text-sm tracking-widest uppercase font-bold">Multiplayer Social Deduction</p>
          </div>
          <Card>
            <div className="space-y-6">
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
          {error && <div className="text-rose-400 text-center text-sm bg-rose-950/30 p-3 rounded-xl border border-rose-900/50 flex gap-2 items-center justify-center"><AlertCircle className="w-4 h-4"/> {error}</div>}
          <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 flex gap-3 items-center">
            <Globe className="w-6 h-6 text-cyan-500 shrink-0" />
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black leading-tight">
              Cross-Device Play Active. All players must have internet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'LOBBY') {
    const amIInList = gameState?.players.some(p => p.id === userId);
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center">
        <div className="max-w-2xl w-full space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <div className="flex items-end justify-between border-b border-slate-800 pb-6">
              <div className="space-y-1">
                  <div className="flex items-center gap-2 text-cyan-500">
                    <Wifi className="w-3 h-3 animate-pulse" />
                    <h2 className="text-xs font-black uppercase tracking-[0.2em]">Room Code</h2>
                  </div>
                  <div className="text-7xl font-mono font-black text-cyan-400 leading-none drop-shadow-[0_0_20px_rgba(34,211,238,0.4)] tracking-wider uppercase">{activeRoomCode}</div>
              </div>
              <div className="text-right hidden sm:block">
                  <div className="text-slate-500 text-xs font-black uppercase tracking-[0.2em]">Players Joined</div>
                  <div className="text-5xl font-black text-slate-300 leading-none">{gameState?.players.length || 0}</div>
              </div>
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {gameState?.players.map(player => (
                  <div key={player.id} className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl flex items-center gap-4 shadow-lg animate-in fade-in scale-95">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-inner ${player.isHost ? 'bg-amber-500 text-amber-950' : 'bg-slate-700 text-slate-300'}`}>
                          {player.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                          <div className="font-bold truncate text-lg">{player.name} {player.id === userId && <span className="text-cyan-500 font-normal text-xs">(You)</span>}</div>
                          {player.isHost && <div className="text-xs text-amber-500 font-bold flex items-center gap-1 uppercase tracking-wider"><Crown className="w-3 h-3"/> Host</div>}
                      </div>
                      {player.id === userId && <CheckCircle2 className="w-5 h-5 text-cyan-500" />}
                  </div>
              ))}
              {!amIInList && (
                <div className="col-span-full py-12 flex flex-col items-center gap-4 bg-slate-800/20 border-2 border-dashed border-slate-700 rounded-3xl animate-pulse">
                  <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-sm text-center">Attempting to Join Room {activeRoomCode}...</p>
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
                           <span className="font-mono text-2xl font-black text-cyan-400 w-8 text-center">{gameState?.settings.impostorCount || 1}</span>
                           <button onClick={() => setGameState(prev => prev ? ({...prev, settings: {impostorCount: Math.min(Math.max(1, (gameState?.players.length || 1) - 1), prev.settings.impostorCount + 1)}}) : null)} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 font-black text-xl">+</button>
                       </div>
                   </div>
                   <Button onClick={startGame} isLoading={isLoading} disabled={(gameState?.players.length || 0) < 2} size="lg" className="w-full py-6">
                        <Play className="w-6 h-6 fill-current" /> Start Mission
                   </Button>
               </Card>
           ) : amIInList && (
             <div className="flex flex-col items-center gap-4 py-8 bg-slate-800/20 rounded-3xl border border-slate-800">
                <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                <div className="text-center">
                  <p className="text-slate-300 font-black uppercase tracking-[0.2em] text-sm">Synchronized!</p>
                  <p className="text-slate-500 text-[10px] font-bold mt-2 uppercase tracking-widest">The Host is preparing the round...</p>
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
                    <div className={`w-3 h-3 rounded-full animate-pulse ${isHost ? 'bg-amber-500' : 'bg-cyan-500'}`} />
                    <span className="font-black text-xs uppercase tracking-widest">{me.name}</span>
                </div>
                {isHost && <Button variant="danger" size="sm" onClick={resetGame} className="px-4 text-xs font-black uppercase"><RefreshCw className="w-3 h-3" /> End Round</Button>}
            </div>

            <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-center p-6 space-y-12 animate-in fade-in zoom-in duration-700">
                <div className="text-center space-y-3">
                    <h2 className="text-slate-500 uppercase tracking-[0.4em] text-[10px] font-black">Mission Category</h2>
                    <p className="text-5xl font-black text-cyan-400 drop-shadow-lg tracking-tight uppercase">{gameState.roundData?.category}</p>
                </div>

                <div className="w-full aspect-[4/5] relative perspective-1000">
                    <button 
                      onClick={() => setIsRevealed(!isRevealed)} 
                      className="w-full h-full relative group focus:outline-none"
                    >
                        {isRevealed ? (
                            <div className={`w-full h-full rounded-[3rem] p-10 flex flex-col items-center justify-center text-center gap-8 shadow-2xl border-4 transition-all duration-500 ${isImpostor ? 'bg-gradient-to-br from-rose-900 via-rose-950 to-black border-rose-500 shadow-rose-900/60' : 'bg-gradient-to-br from-cyan-900 via-cyan-950 to-black border-cyan-500 shadow-cyan-900/60'}`}>
                                {isImpostor ? (
                                    <>
                                        <div className="p-8 bg-rose-500/10 rounded-full animate-pulse"><ShieldAlert className="w-28 h-28 text-rose-500" /></div>
                                        <div className="space-y-4">
                                          <h3 className="text-6xl font-black text-rose-100 italic tracking-tighter uppercase leading-none drop-shadow-md">Impostor</h3>
                                          <p className="text-rose-400 font-bold text-xs uppercase tracking-[0.3em] mt-2 opacity-80">Find the word by blending in</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-8 bg-cyan-500/10 rounded-full"><Users className="w-28 h-28 text-cyan-500" /></div>
                                        <div className="space-y-4">
                                          <h3 className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em]">Secret Word</h3>
                                          <p className="text-6xl font-black text-white tracking-tighter leading-none drop-shadow-md uppercase">{gameState.roundData?.topic}</p>
                                        </div>
                                    </>
                                )}
                                <div className="absolute bottom-12 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                                    <EyeOff className="w-4 h-4" /> Tap to Hide Secret
                                </div>
                            </div>
                        ) : (
                            <div className="w-full h-full bg-slate-800 rounded-[3rem] border-4 border-slate-700 flex flex-col items-center justify-center gap-8 transition-all hover:border-slate-500 hover:bg-slate-700/80 shadow-2xl group">
                                <div className="w-40 h-40 rounded-full bg-slate-900 flex items-center justify-center border-4 border-slate-800 shadow-inner group-hover:scale-110 transition-transform duration-500 relative">
                                    <span className="text-8xl font-black text-slate-700 select-none">?</span>
                                </div>
                                <div className="text-center space-y-2">
                                  <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-sm">Tap to Reveal</p>
                                  <p className="text-slate-600 text-[10px] uppercase font-bold tracking-widest">Keep it secret!</p>
                                </div>
                            </div>
                        )}
                    </button>
                </div>
            </div>
        </div>
      );
  }
  return null;
};

export default App;