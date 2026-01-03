
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, Player, LocalGameState, GameMode, NetworkMessage } from './types.ts';
import { generateGameTopic } from './services/geminiService.ts';
import { useGameNetwork } from './services/comms.ts';
import { Button } from './components/Button.tsx';
import { Input } from './components/Input.tsx';
import { Card } from './components/Card.tsx';
import { 
  Users, 
  Play, 
  RefreshCw, 
  Eye, 
  ShieldAlert,
  ChevronRight,
  Clock,
  ArrowRight,
  Globe,
  Smartphone,
  Copy,
  Check
} from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<LocalGameState>({
    status: GameStatus.LOBBY,
    mode: 'LOCAL',
    players: [],
    impostorCount: 1,
    currentPlayerIndex: 0
  });

  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState<string[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [isHolding, setIsHolding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Network Hook
  const { sendMessage } = useGameNetwork(state.roomCode || null, (msg) => {
    if (msg.type === 'JOIN_REQUEST' && state.mode === 'ONLINE' && state.players[0]?.isHost) {
      // Host receives join request
      setState(prev => {
        if (prev.players.find(p => p.id === msg.payload.player.id)) return prev;
        const newState = { ...prev, players: [...prev.players, msg.payload.player] };
        sendMessage({ type: 'STATE_UPDATE', payload: { state: newState } });
        return newState;
      });
    } else if (msg.type === 'STATE_UPDATE') {
      // Clients receive state from host
      if (state.status !== GameStatus.PLAYING && state.status !== GameStatus.REVEALING) {
        setState(msg.payload.state);
      }
    } else if (msg.type === 'START_GAME') {
      // All clients start mission
      setState(prev => ({
        ...prev,
        status: GameStatus.PASSING,
        players: msg.payload.players,
        roundData: msg.payload.roundData,
        currentPlayerIndex: 0
      }));
    }
  });

  const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

  const handleHost = () => {
    const code = generateRoomCode();
    const host: Player = { id: Math.random().toString(36).substring(7), name: 'Host', isHost: true, hasSeenRole: false };
    setState({
      status: GameStatus.SETUP,
      mode: 'ONLINE',
      roomCode: code,
      players: [host],
      impostorCount: 1,
      currentPlayerIndex: 0
    });
  };

  const handleJoin = () => {
    if (!joinCode || joinCode.length < 3) return;
    const me: Player = { id: Math.random().toString(36).substring(7), name: 'Guest', hasSeenRole: false };
    setState({
      status: GameStatus.SETUP,
      mode: 'ONLINE',
      roomCode: joinCode.toUpperCase(),
      players: [me],
      impostorCount: 1,
      currentPlayerIndex: 0
    });
    // Send join request immediately
    setTimeout(() => {
      sendMessage({ type: 'JOIN_REQUEST', payload: { player: me } }, joinCode.toUpperCase());
    }, 500);
  };

  const handleLocal = () => {
    setState({
      status: GameStatus.SETUP,
      mode: 'LOCAL',
      players: [],
      impostorCount: 1,
      currentPlayerIndex: 0
    });
  };

  const handleStartGame = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // Fetch topic from Gemini with a timeout race as a network safety net
      const topicPromise = generateGameTopic();
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      
      let topicData = await Promise.race([topicPromise, timeoutPromise]);
      
      // If API times out (returns null), fallback to retrying generating topic (which defaults to local)
      if (!topicData) {
        console.warn("API Timed out, using internal fallback");
        topicData = await generateGameTopic(); 
      }

      // Assign roles
      const currentPlayers = state.mode === 'LOCAL' 
        ? names.map((name, i) => ({ id: i.toString(), name: name || `Player ${i+1}`, hasSeenRole: false }))
        : state.players;

      const indices = Array.from({ length: currentPlayers.length }, (_, i) => i);
      const shuffled = indices.sort(() => Math.random() - 0.5);
      const impostorIndices = shuffled.slice(0, Math.min(state.impostorCount, Math.floor(currentPlayers.length / 2)));

      const finalPlayers: Player[] = currentPlayers.map((p, i) => ({
        ...p,
        role: impostorIndices.includes(i) ? 'impostor' : 'innocent',
      }));

      if (state.mode === 'ONLINE') {
        sendMessage({ 
          type: 'START_GAME', 
          payload: { roundData: topicData, players: finalPlayers } 
        });
      }

      setState(prev => ({
        ...prev,
        status: GameStatus.PASSING,
        players: finalPlayers,
        currentPlayerIndex: 0,
        roundData: topicData!
      }));
    } catch (e) {
      console.error("Game start error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSetup = () => {
    if (state.mode === 'LOCAL') {
      setNames(Array(playerCount).fill('').map((_, i) => `Player ${i + 1}`));
      setState(prev => ({ ...prev, status: GameStatus.NAMES }));
    } else {
      // Online mode setup is complete, direct to game start
      handleStartGame();
    }
  };

  const resetToSetup = () => {
    setState({
      status: GameStatus.LOBBY,
      mode: 'LOCAL',
      players: [],
      impostorCount: 1,
      currentPlayerIndex: 0
    });
  };

  // Logic to advance the game state after a player has seen their identity/secret word
  const finishReveal = () => {
    setState(prev => {
      const isLastPlayer = prev.currentPlayerIndex === prev.players.length - 1;
      if (isLastPlayer) {
        // All players have seen their roles, start the game
        return {
          ...prev,
          status: GameStatus.PLAYING,
          currentPlayerIndex: 0
        };
      } else {
        // Move to the next player's passing screen
        return {
          ...prev,
          status: GameStatus.PASSING,
          currentPlayerIndex: prev.currentPlayerIndex + 1
        };
      }
    });
  };

  // Helper container to ensure mobile centering works without clipping
  const Container = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`min-h-dvh w-full bg-slate-900 text-slate-100 flex flex-col p-6 sm:p-4 overflow-y-auto overflow-x-hidden ${className}`}>
      <div className="w-full max-w-md mx-auto my-auto flex flex-col gap-6">
        {children}
      </div>
    </div>
  );

  // UI VIEWS
  
  if (state.status === GameStatus.LOBBY) {
    return (
      <Container>
        <div className="space-y-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center space-y-4">
            <h1 className="text-7xl font-black bg-gradient-to-br from-cyan-400 via-purple-500 to-rose-500 bg-clip-text text-transparent tracking-tighter drop-shadow-2xl">IMPOSTOR</h1>
            <p className="text-slate-500 font-bold text-[10px] tracking-[0.5em] uppercase">The Ultimate AI Social Deduction</p>
          </div>

          <div className="grid gap-4">
            <Button variant="primary" size="lg" onClick={handleLocal} className="w-full py-6 rounded-3xl border-b-4 border-cyan-700 active:border-b-0 shadow-2xl">
              <Smartphone className="w-6 h-6" /> Local Pass & Play
            </Button>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
              <div className="relative flex justify-center text-xs uppercase font-black text-slate-600 tracking-[0.3em] bg-slate-900 px-4">Online (Beta)</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button variant="secondary" onClick={handleHost} className="py-5 rounded-3xl border-b-4 border-slate-800">
                <Globe className="w-5 h-5" /> Host
              </Button>
              <Button variant="secondary" onClick={() => setJoinCode('JOIN')} className="py-5 rounded-3xl border-b-4 border-slate-800">
                <Users className="w-5 h-5" /> Join
              </Button>
            </div>

            {joinCode === 'JOIN' && (
              <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                <Input 
                  autoFocus
                  placeholder="ROOM CODE" 
                  value={joinCode === 'JOIN' ? '' : joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="text-center text-2xl font-black tracking-widest uppercase py-4"
                  maxLength={4}
                />
                <Button variant="primary" onClick={handleJoin} className="w-full py-4">Enter Room</Button>
              </div>
            )}
          </div>
        </div>
      </Container>
    );
  }

  if (state.status === GameStatus.SETUP) {
    const isHost = state.mode === 'LOCAL' || state.players[0]?.isHost;

    return (
      <Container>
        <div className="flex-1 flex flex-col space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-center">
             <Button variant="ghost" size="sm" onClick={resetToSetup}><RefreshCw className="w-4 h-4" /></Button>
             <h2 className="text-sm font-black tracking-[0.3em] uppercase text-slate-500">
               {state.mode === 'LOCAL' ? 'Local Game' : `Room: ${state.roomCode}`}
             </h2>
             <div className="w-10"></div>
          </div>

          {state.mode === 'ONLINE' && (
            <Card className="text-center space-y-2 border-dashed border-2 border-slate-700">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Share Room Code</p>
              <div className="flex items-center justify-center gap-4">
                <h3 className="text-4xl font-black tracking-widest text-white">{state.roomCode}</h3>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(state.roomCode || '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-slate-400" />}
                </button>
              </div>
            </Card>
          )}

          <Card className="space-y-8 flex-1">
            {state.mode === 'LOCAL' ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Users className="w-4 h-4" /> Player Count
                    </label>
                    <span className="text-2xl font-black text-cyan-400">{playerCount}</span>
                  </div>
                  <input 
                    type="range" min="3" max="12" 
                    value={playerCount} 
                    onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 touch-pan-x"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                   <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Connected ({state.players.length})</h3>
                </div>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {state.players.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">{idx+1}</div>
                        {isHost && p.id === state.players[0].id ? (
                           <Input 
                             value={p.name} 
                             onChange={(e) => {
                               const newPlayers = [...state.players];
                               newPlayers[idx].name = e.target.value;
                               setState({ ...state, players: newPlayers });
                               sendMessage({ type: 'STATE_UPDATE', payload: { state: { ...state, players: newPlayers } } });
                             }} 
                             className="!py-1 !px-2 !bg-transparent !border-none font-bold"
                           />
                        ) : <span className="font-bold">{p.name}</span>}
                      </div>
                      {p.isHost && <ShieldAlert className="w-4 h-4 text-rose-500" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-slate-700">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Impostors
                </label>
                <span className="text-2xl font-black text-rose-500">{state.impostorCount}</span>
              </div>
              <input 
                type="range" min="1" max={Math.max(1, Math.floor(playerCount / 2))} 
                value={state.impostorCount} 
                onChange={(e) => setState({...state, impostorCount: parseInt(e.target.value)})}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500 touch-pan-x"
                disabled={!isHost}
              />
            </div>
          </Card>

          {isHost ? (
            <Button onClick={handleStartSetup} className="w-full py-5 text-lg rounded-3xl shadow-xl">
              {state.mode === 'LOCAL' ? 'Enter Player Names' : 'Start Mission'} <ChevronRight className="w-5 h-5" />
            </Button>
          ) : (
            <div className="p-6 bg-slate-800/50 rounded-3xl text-center border border-slate-700 animate-pulse">
               <p className="text-sm font-bold text-slate-400">Waiting for host to start...</p>
            </div>
          )}
        </div>
      </Container>
    );
  }

  if (state.status === GameStatus.NAMES) {
    return (
      <Container>
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xl font-black uppercase tracking-widest text-center">Who's In?</h2>
          <Card className="max-h-[50vh] overflow-y-auto space-y-3 custom-scrollbar">
            {names.map((name, i) => (
              <Input 
                key={i}
                placeholder={`Player ${i + 1}`} 
                value={name} 
                onChange={(e) => {
                  const newNames = [...names];
                  newNames[i] = e.target.value;
                  setNames(newNames);
                }} 
              />
            ))}
          </Card>
          <Button onClick={handleStartGame} isLoading={isLoading} className="w-full py-5 rounded-3xl text-xl shadow-2xl">
            <Play className="w-6 h-6 fill-current" /> Start Mission
          </Button>
        </div>
      </Container>
    );
  }

  if (state.status === GameStatus.PASSING) {
    const currentPlayer = state.players[state.currentPlayerIndex];
    return (
      <Container>
        <div className="space-y-12 text-center animate-in zoom-in-95 duration-500">
          <div className="space-y-4">
            <div className="inline-flex p-6 rounded-full bg-slate-800 border-2 border-slate-700 shadow-2xl">
               <Users className="w-16 h-16 text-cyan-500" />
            </div>
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.5em]">Identity Check</h2>
          </div>

          <div className="space-y-2">
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Pass to</p>
            <h3 className="text-6xl font-black text-white tracking-tighter drop-shadow-lg break-words">{currentPlayer.name}</h3>
          </div>

          <Button variant="primary" size="lg" onClick={() => setState(prev => ({ ...prev, status: GameStatus.REVEALING }))} className="w-full py-8 rounded-[2.5rem] text-2xl font-black border-b-8 border-cyan-700 active:border-b-0 active:translate-y-2 transition-all">
             I am {currentPlayer.name}
          </Button>
        </div>
      </Container>
    );
  }

  if (state.status === GameStatus.REVEALING) {
    const currentPlayer = state.players[state.currentPlayerIndex];
    const isImpostor = currentPlayer.role === 'impostor';
    
    return (
      <div className="min-h-dvh bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 select-none touch-none overflow-hidden">
        <div className="max-w-md w-full space-y-12 text-center animate-in fade-in duration-300">
           <div className="space-y-2">
              <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">Keep it Secret</p>
              <h2 className="text-3xl font-black text-white">{currentPlayer.name}</h2>
           </div>

           <div className="relative group">
              <button 
                onContextMenu={(e) => e.preventDefault()}
                onMouseDown={() => setIsHolding(true)}
                onMouseUp={() => setIsHolding(false)}
                onMouseLeave={() => setIsHolding(false)}
                onTouchStart={(e) => { e.preventDefault(); setIsHolding(true); }}
                onTouchEnd={(e) => { e.preventDefault(); setIsHolding(false); }}
                className={`w-full aspect-square rounded-[4rem] border-4 transition-all duration-300 flex flex-col items-center justify-center gap-6 shadow-2xl cursor-pointer ${isHolding ? 'bg-slate-800 border-slate-400 scale-[0.98]' : 'bg-slate-900 border-slate-700 border-dashed hover:border-slate-500'}`}
              >
                {isHolding ? (
                  <>
                    <div className="space-y-1 animate-in zoom-in-95 duration-200">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Identity</p>
                      <h4 className={`text-5xl font-black italic tracking-tighter ${isImpostor ? 'text-rose-500' : 'text-cyan-400'}`}>
                        {isImpostor ? 'IMPOSTOR' : 'INNOCENT'}
                      </h4>
                    </div>
                    <div className="space-y-1 animate-in zoom-in-95 duration-300">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Secret Word</p>
                      <h4 className="text-4xl font-black text-white uppercase tracking-tight">
                        {isImpostor ? '???' : state.roundData?.topic}
                      </h4>
                    </div>
                  </>
                ) : (
                  <>
                    <Eye className="w-24 h-24 text-slate-700 opacity-50" />
                    <p className="text-sm font-black uppercase tracking-[0.4em] text-slate-600">Hold to Reveal</p>
                  </>
                )}
              </button>
           </div>

           <Button 
            variant="secondary" 
            className="w-full py-5 rounded-[2rem] text-lg font-bold" 
            onClick={finishReveal}
            disabled={isHolding}
           >
             Got it!
           </Button>
        </div>
      </div>
    );
  }

  if (state.status === GameStatus.PLAYING) {
    return (
      <Container>
        <div className="w-full flex justify-between items-center mb-8">
           <h1 className="text-xl font-black italic tracking-tighter text-cyan-400 uppercase">Mission Data</h1>
           <Button variant="ghost" size="sm" onClick={resetToSetup} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">
             <RefreshCw className="w-3 h-3" /> Abort
           </Button>
        </div>

        <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-700">
           <Card className="text-center space-y-4 border-2 border-slate-700 bg-slate-800/80 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
              <div className="space-y-1 pt-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6em]">Category</p>
                <h2 className="text-6xl font-black text-white tracking-tighter uppercase drop-shadow-md break-words">{state.roundData?.category}</h2>
              </div>
           </Card>

           <div className="space-y-6">
              <div className="flex items-center gap-2 px-2">
                 <Users className="w-4 h-4 text-cyan-500" />
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Survivor Roster</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {state.players.map(p => (
                  <div key={p.id} className="p-4 bg-slate-800/40 rounded-3xl border border-slate-700/50 flex items-center gap-4 hover:bg-slate-800 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center font-black text-lg text-slate-400 border border-slate-600">
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-200 truncate">{p.name}</span>
                  </div>
                ))}
              </div>
           </div>

           <div className="p-8 bg-cyan-500/5 rounded-[3rem] border border-cyan-500/10 text-center space-y-6 shadow-inner">
              <Clock className="w-12 h-12 text-cyan-400 mx-auto animate-pulse" />
              <div className="space-y-3">
                <p className="text-lg font-bold text-white leading-tight">
                  Discuss and vote. Find the impostor before they guess the word.
                </p>
                <div className="inline-flex px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40">
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                    Targets: {state.impostorCount} Impostor{state.impostorCount > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
           </div>
        </div>
      </Container>
    );
  }

  return null;
};

export default App;
