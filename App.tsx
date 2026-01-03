import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameState, GameStatus, Player, NetworkMessage } from './types';
import { useGameNetwork } from './services/comms';
import { generateGameTopic } from './services/geminiService';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { Card } from './components/Card';
import { 
  Users, 
  Play, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Crown, 
  AlertTriangle,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

// Initial state helpers
const generateRoomCode = () => Math.floor(100 + Math.random() * 900).toString();
const generateId = () => Math.random().toString(36).substring(2, 9);

const App: React.FC = () => {
  // --- Local User State ---
  const [userId] = useState(generateId());
  const [userName, setUserName] = useState('');
  const [inputCode, setInputCode] = useState('');
  
  // --- Game State ---
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // --- UI State ---
  const [view, setView] = useState<'LANDING' | 'LOBBY' | 'GAME'>('LANDING');
  const [isRevealed, setIsRevealed] = useState(false);

  // --- Network Handler ---
  const handleMessage = useCallback((msg: NetworkMessage) => {
    if (!gameState && msg.type === 'STATE_UPDATE') {
        // If we are looking for a game
        // Logic: if we are in LANDING and just sent a join request, we accept this state
        // However, for simplicity in this demo, if the room code matches input, we accept.
        return; 
    }

    if (gameState) {
      if (msg.type === 'JOIN_REQUEST' && gameState.players.some(p => p.isHost && p.id === userId)) {
        // I am host, handle join request
        if (msg.payload.roomCode === gameState.roomCode) {
          const newPlayer: Player = {
            id: msg.payload.playerId,
            name: msg.payload.name,
            isHost: false
          };
          
          // Prevent duplicate joins
          if (!gameState.players.find(p => p.id === newPlayer.id)) {
             const newPlayers = [...gameState.players, newPlayer];
             const newErrors = null;
             
             // Update my state
             const newState = { ...gameState, players: newPlayers };
             setGameState(newState);
             // Broadcast new state to everyone
             sendMessage({ type: 'STATE_UPDATE', payload: newState });
          }
        }
      } else if (msg.type === 'STATE_UPDATE') {
        // I am a client (or host receiving echo), update my state if room matches
        if (msg.payload.roomCode === gameState.roomCode) {
          // Merge state but keep my local ID perspective
           setGameState(msg.payload);
           if (msg.payload.status === 'PLAYING') setView('GAME');
           if (msg.payload.status === 'LOBBY') setView('LOBBY');
        }
      } else if (msg.type === 'RESET_GAME') {
          // Reset to lobby
           setGameState(prev => prev ? ({ ...prev, status: GameStatus.LOBBY, roundData: undefined, players: prev.players.map(p => ({...p, role: undefined})) }) : null);
           setView('LOBBY');
      }
    }
  }, [gameState, userId]);

  const { sendMessage } = useGameNetwork(handleMessage);

  // --- Actions ---

  const createGame = () => {
    if (!userName) return setError("Please enter your name");
    const code = generateRoomCode();
    const newGameState: GameState = {
      roomCode: code,
      status: GameStatus.LOBBY,
      settings: { impostorCount: 1 },
      players: [{ id: userId, name: userName, isHost: true }]
    };
    setGameState(newGameState);
    setView('LOBBY');
    
    // Announce existence (mainly for debug or reconnection, though not strictly needed for this simple flow)
    sendMessage({ type: 'STATE_UPDATE', payload: newGameState });
  };

  const joinGame = () => {
    if (!userName || !inputCode) return setError("Name and Room Code are required");
    // We optimistically enter a "Joining" state or wait for a response.
    // For this simple P2P demo, we will listen for the specific game state.
    
    // We temporarily create a partial state to listen to updates
    const tempState: GameState = {
        roomCode: inputCode,
        status: GameStatus.LOBBY,
        settings: { impostorCount: 1 },
        players: []
    };
    setGameState(tempState);
    
    sendMessage({ 
      type: 'JOIN_REQUEST', 
      payload: { name: userName, roomCode: inputCode, playerId: userId } 
    });
    
    // In a real app we'd wait for ACK. Here we just switch view if we receive a STATE_UPDATE later.
    // We'll show a loading screen or lobby immediately.
    setView('LOBBY');
  };

  const startGame = async () => {
    if (!gameState) return;
    setIsLoading(true);
    
    try {
      const { category, topic } = await generateGameTopic();
      
      const playerCount = gameState.players.length;
      const impostorCount = gameState.settings.impostorCount;
      
      // Randomly assign roles
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
      setError("Failed to start game. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetGame = () => {
    if (!gameState) return;
    sendMessage({ type: 'RESET_GAME', payload: null });
    // Host also resets locally
    setGameState(prev => prev ? ({ ...prev, status: GameStatus.LOBBY, roundData: undefined, players: prev.players.map(p => ({...p, role: undefined})) }) : null);
    setView('LOBBY');
  };

  // --- Derived State ---
  const me = gameState?.players.find(p => p.id === userId);
  const isHost = me?.isHost || false;

  // --- Views ---

  if (view === 'LANDING') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black bg-gradient-to-br from-cyan-400 to-purple-600 bg-clip-text text-transparent">
              IMPOSTOR
            </h1>
            <p className="text-slate-400">Can you blend in?</p>
             <div className="inline-flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded-full text-xs text-slate-400 border border-slate-700/50">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                <span>Multi-tab support enabled (BroadcastChannel)</span>
            </div>
          </div>

          <Card>
            <div className="space-y-6">
              <Input 
                label="Your Name" 
                placeholder="Enter nickname..." 
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
              
              <div className="grid grid-cols-2 gap-4">
                 {/* HOST TAB */}
                 <div className="col-span-2 md:col-span-1 space-y-4">
                    <div className="h-full flex flex-col justify-between">
                        <Button onClick={createGame} className="w-full h-full min-h-[120px] flex-col gap-3">
                            <Crown className="w-8 h-8" />
                            <span>Host New Game</span>
                        </Button>
                    </div>
                 </div>

                 {/* JOIN TAB */}
                 <div className="col-span-2 md:col-span-1 space-y-2">
                     <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 space-y-3">
                        <Input 
                            placeholder="3-digit Code" 
                            className="text-center font-mono text-lg tracking-widest"
                            maxLength={3}
                            value={inputCode}
                            onChange={(e) => setInputCode(e.target.value)}
                        />
                        <Button variant="secondary" onClick={joinGame} className="w-full">
                            Join Game
                        </Button>
                     </div>
                 </div>
              </div>
            </div>
          </Card>
          
          {error && (
            <div className="text-rose-400 text-center text-sm bg-rose-950/30 p-3 rounded-lg border border-rose-900">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'LOBBY' && gameState) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
           {/* Header */}
           <div className="flex items-center justify-between">
              <div>
                  <h2 className="text-slate-400 text-sm font-bold uppercase tracking-wider">Room Code</h2>
                  <div className="text-5xl font-mono font-black text-cyan-400 tracking-widest">{gameState.roomCode}</div>
              </div>
              <div className="text-right">
                  <div className="text-slate-400 text-sm">Players</div>
                  <div className="text-2xl font-bold">{gameState.players.length}</div>
              </div>
           </div>

           {/* Players List */}
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {gameState.players.map(player => (
                  <div key={player.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${player.isHost ? 'bg-amber-500 text-amber-950' : 'bg-slate-600'}`}>
                          {player.name[0].toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                          <div className="font-bold truncate">{player.name}</div>
                          {player.isHost && <div className="text-xs text-amber-500 flex items-center gap-1"><Crown className="w-3 h-3"/> Host</div>}
                      </div>
                  </div>
              ))}
              {/* Empty slots placeholders */}
              {Array.from({length: Math.max(0, 3 - gameState.players.length)}).map((_, i) => (
                  <div key={i} className="border-2 border-dashed border-slate-800 rounded-xl p-4 flex items-center justify-center text-slate-700">
                      Waiting...
                  </div>
              ))}
           </div>

           {/* Host Controls */}
           {isHost ? (
               <Card className="space-y-4 border-cyan-900/50 bg-cyan-950/10">
                   <div className="flex items-center justify-between">
                       <span className="font-bold text-slate-300">Number of Impostors</span>
                       <div className="flex items-center gap-4 bg-slate-900 rounded-lg p-1">
                           <button 
                             onClick={() => {
                                 const newCount = Math.max(1, gameState.settings.impostorCount - 1);
                                 const newS = { ...gameState, settings: { ...gameState.settings, impostorCount: newCount } };
                                 setGameState(newS);
                                 sendMessage({ type: 'STATE_UPDATE', payload: newS });
                             }}
                             className="w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded font-bold text-slate-400"
                           >-</button>
                           <span className="font-mono w-4 text-center">{gameState.settings.impostorCount}</span>
                           <button 
                             onClick={() => {
                                 const newCount = Math.min(gameState.players.length - 1, gameState.settings.impostorCount + 1);
                                 const newS = { ...gameState, settings: { ...gameState.settings, impostorCount: newCount } };
                                 setGameState(newS);
                                 sendMessage({ type: 'STATE_UPDATE', payload: newS });
                             }}
                             className="w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded font-bold text-slate-400"
                           >+</button>
                       </div>
                   </div>
                   <Button onClick={startGame} isLoading={isLoading} disabled={gameState.players.length < 3} className="w-full">
                        <Play className="w-5 h-5" /> Start Game
                   </Button>
                   {gameState.players.length < 3 && (
                       <p className="text-center text-xs text-slate-500">Need at least 3 players to start.</p>
                   )}
               </Card>
           ) : (
               <div className="text-center p-8 text-slate-500 animate-pulse">
                   Waiting for host to start...
               </div>
           )}
        </div>
      </div>
    );
  }

  if (view === 'GAME' && gameState && me) {
      const isImpostor = me.role === 'impostor';
      
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
            {/* Top Bar */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 backdrop-blur sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isHost ? 'bg-amber-500' : 'bg-cyan-500'}`} />
                    <span className="font-bold">{me.name}</span>
                </div>
                {isHost && (
                    <Button variant="ghost" size="sm" onClick={resetGame} className="text-xs px-2 py-1 h-auto">
                        <RefreshCw className="w-3 h-3" /> End Game
                    </Button>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
                
                <div className="text-center space-y-2">
                    <h2 className="text-slate-400 uppercase tracking-widest text-sm font-bold">Category</h2>
                    <p className="text-2xl font-bold text-cyan-400">{gameState.roundData?.category}</p>
                </div>

                <div className="w-full max-w-sm perspective-1000">
                    <button 
                        onClick={() => setIsRevealed(!isRevealed)}
                        className="w-full relative group transition-all duration-300 transform active:scale-95 focus:outline-none"
                    >
                        {isRevealed ? (
                            <div className={`
                                w-full aspect-[3/4] rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-6 shadow-2xl border-2
                                ${isImpostor 
                                    ? 'bg-gradient-to-br from-rose-900 to-rose-950 border-rose-500 shadow-rose-900/20' 
                                    : 'bg-gradient-to-br from-cyan-900 to-cyan-950 border-cyan-500 shadow-cyan-900/20'}
                            `}>
                                {isImpostor ? (
                                    <>
                                        <ShieldAlert className="w-20 h-20 text-rose-500 animate-pulse" />
                                        <div>
                                            <h3 className="text-3xl font-black text-rose-100 mb-2">IMPOSTOR</h3>
                                            <p className="text-rose-200/70 text-sm">Blend in. Don't let them know you don't know.</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-20 h-20 text-cyan-500" />
                                        <div>
                                            <h3 className="text-xl font-bold text-cyan-100 mb-4">SECRET WORD</h3>
                                            <p className="text-4xl font-black text-white">{gameState.roundData?.topic}</p>
                                        </div>
                                        <p className="text-cyan-200/70 text-sm mt-4">Find the impostor among you.</p>
                                    </>
                                )}
                                <div className="absolute bottom-6 flex items-center gap-2 text-xs uppercase tracking-widest opacity-50">
                                    <EyeOff className="w-4 h-4" /> Tap to Hide
                                </div>
                            </div>
                        ) : (
                            <div className="w-full aspect-[3/4] bg-slate-800 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-4 shadow-xl group-hover:border-slate-600 transition-colors cursor-pointer">
                                <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center">
                                    <span className="text-4xl">?</span>
                                </div>
                                <p className="text-slate-400 font-bold uppercase tracking-widest">Tap to Reveal Role</p>
                            </div>
                        )}
                    </button>
                </div>

                <div className="text-center max-w-xs text-sm text-slate-500">
                    {isHost ? "When you are ready to vote or start a new round, click 'End Game' at the top." : "Waiting for host to end the round."}
                </div>
            </div>
        </div>
      );
  }

  return null;
};

export default App;
