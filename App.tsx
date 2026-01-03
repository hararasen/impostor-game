
import React, { useState } from 'react';
import { GameStatus, Player, LocalGameState } from './types.ts';
import { generateGameTopic } from './services/geminiService.ts';
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
  Smartphone
} from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<LocalGameState>({
    status: GameStatus.LOBBY,
    players: [],
    impostorCount: 1,
    currentPlayerIndex: 0
  });

  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState<string[]>([]);
  const [isHolding, setIsHolding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartSetup = () => {
    setState({
      status: GameStatus.SETUP,
      players: [],
      impostorCount: 1,
      currentPlayerIndex: 0
    });
  };

  const handleEnterNames = () => {
    setNames(Array(playerCount).fill('').map((_, i) => `Player ${i + 1}`));
    setState(prev => ({ ...prev, status: GameStatus.NAMES }));
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
      const currentPlayers = names.map((name, i) => ({ 
        id: i.toString(), 
        name: name || `Player ${i+1}`, 
        hasSeenRole: false 
      }));

      const indices = Array.from({ length: currentPlayers.length }, (_, i) => i);
      const shuffled = indices.sort(() => Math.random() - 0.5);
      const impostorIndices = shuffled.slice(0, Math.min(state.impostorCount, Math.floor(currentPlayers.length / 2)));

      const finalPlayers: Player[] = currentPlayers.map((p, i) => ({
        ...p,
        role: impostorIndices.includes(i) ? 'impostor' : 'innocent',
      }));

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

  const resetToLobby = () => {
    setState({
      status: GameStatus.LOBBY,
      players: [],
      impostorCount: 1,
      currentPlayerIndex: 0
    });
  };

  const resetToSetup = () => {
    setState({
      status: GameStatus.SETUP,
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
        <div className="space-y-12 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center space-y-4">
            <h1 className="text-7xl font-black bg-gradient-to-br from-cyan-400 via-purple-500 to-rose-500 bg-clip-text text-transparent tracking-tighter drop-shadow-2xl">IMPOSTOR</h1>
            <p className="text-slate-500 font-bold text-[10px] tracking-[0.5em] uppercase">The Ultimate AI Social Deduction</p>
          </div>

          <div className="space-y-6">
            <Button variant="primary" size="lg" onClick={handleStartSetup} className="w-full py-8 rounded-[2rem] border-b-8 border-cyan-700 active:border-b-0 active:translate-y-2 shadow-2xl text-2xl">
              <Play className="w-8 h-8 fill-current" /> Start Game
            </Button>
            
            <div className="text-center">
               <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Local Pass & Play</p>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  if (state.status === GameStatus.SETUP) {
    return (
      <Container>
        <div className="flex-1 flex flex-col space-y-8 animate-in fade-in duration-500">
          <div className="flex justify-between items-center">
             <Button variant="ghost" size="sm" onClick={resetToLobby}><RefreshCw className="w-4 h-4" /></Button>
             <h2 className="text-sm font-black tracking-[0.3em] uppercase text-slate-500">
               Game Setup
             </h2>
             <div className="w-10"></div>
          </div>

          <Card className="space-y-10 flex-1">
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
              />
            </div>
          </Card>

          <Button onClick={handleEnterNames} className="w-full py-5 text-lg rounded-3xl shadow-xl">
             Enter Player Names <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </Container>
    );
  }

  if (state.status === GameStatus.NAMES) {
    return (
      <Container>
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
           <div className="flex justify-between items-center">
             <Button variant="ghost" size="sm" onClick={resetToSetup}><RefreshCw className="w-4 h-4" /></Button>
             <h2 className="text-xl font-black uppercase tracking-widest text-center">Who's In?</h2>
             <div className="w-10"></div>
          </div>
          
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
           <Button variant="ghost" size="sm" onClick={resetToLobby} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white">
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
