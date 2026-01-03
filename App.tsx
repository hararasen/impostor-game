
import React, { useState, useCallback } from 'react';
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
  ArrowRight
} from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<LocalGameState>({
    status: GameStatus.SETUP,
    players: [],
    impostorCount: 1,
    currentPlayerIndex: 0
  });
  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState<string[]>([]);
  const [isHolding, setIsHolding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartSetup = () => {
    setNames(Array(playerCount).fill('').map((_, i) => `Player ${i + 1}`));
    setState(prev => ({ ...prev, status: GameStatus.NAMES }));
  };

  const handleStartGame = async () => {
    setIsLoading(true);
    try {
      const topicData = await generateGameTopic();
      
      const indices = Array.from({ length: playerCount }, (_, i) => i);
      const shuffled = indices.sort(() => Math.random() - 0.5);
      const impostorIndices = shuffled.slice(0, Math.min(state.impostorCount, Math.floor(playerCount / 2)));

      const finalPlayers: Player[] = names.map((name, i) => ({
        id: Math.random().toString(36).substring(2, 9),
        name: name || `Player ${i + 1}`,
        role: impostorIndices.includes(i) ? 'impostor' : 'innocent',
        hasSeenRole: false
      }));

      setState({
        ...state,
        status: GameStatus.PASSING,
        players: finalPlayers,
        currentPlayerIndex: 0,
        roundData: topicData
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmPass = () => {
    setState(prev => ({ ...prev, status: GameStatus.REVEALING }));
  };

  const finishReveal = () => {
    setIsHolding(false);
    const nextIdx = state.currentPlayerIndex + 1;
    if (nextIdx >= state.players.length) {
      setState(prev => ({ ...prev, status: GameStatus.PLAYING }));
    } else {
      setState(prev => ({
        ...prev,
        status: GameStatus.PASSING,
        currentPlayerIndex: nextIdx
      }));
    }
  };

  const resetToSetup = () => {
    setState({
      status: GameStatus.SETUP,
      players: [],
      impostorCount: 1,
      currentPlayerIndex: 0
    });
  };

  if (state.status === GameStatus.SETUP) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 animate-in fade-in duration-500">
          <div className="text-center space-y-2">
            <h1 className="text-6xl font-black bg-gradient-to-br from-cyan-400 via-purple-500 to-rose-500 bg-clip-text text-transparent tracking-tighter">IMPOSTOR</h1>
            <p className="text-slate-400 font-medium text-xs tracking-[0.3em] uppercase font-bold">Local Pass & Play Party Game</p>
          </div>

          <Card className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4" /> Players
                </label>
                <span className="text-2xl font-black text-cyan-400">{playerCount}</span>
              </div>
              <input 
                type="range" min="3" max="12" 
                value={playerCount} 
                onChange={(e) => setPlayerCount(parseInt(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Impostors
                </label>
                <span className="text-2xl font-black text-rose-500">{state.impostorCount}</span>
              </div>
              <input 
                type="range" min="1" max={Math.floor(playerCount / 2)} 
                value={state.impostorCount} 
                onChange={(e) => setState({...state, impostorCount: parseInt(e.target.value)})}
                className="w-full accent-rose-500"
              />
            </div>

            <Button onClick={handleStartSetup} className="w-full py-4 text-lg">
              Next: Enter Names <ChevronRight className="w-5 h-5" />
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (state.status === GameStatus.NAMES) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={resetToSetup}><RefreshCw className="w-4 h-4" /></Button>
            <h2 className="text-xl font-black uppercase tracking-widest">Who's Playing?</h2>
          </div>
          
          <Card className="max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
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

          <Button onClick={handleStartGame} isLoading={isLoading} className="w-full py-4">
            <Play className="w-5 h-5 fill-current" /> Start Mission
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === GameStatus.PASSING) {
    const currentPlayer = state.players[state.currentPlayerIndex];
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-sm w-full space-y-12 text-center animate-in zoom-in-95 duration-500">
          <div className="space-y-4">
            <div className="inline-flex p-4 rounded-3xl bg-slate-800 border border-slate-700">
               <Users className="w-12 h-12 text-slate-500" />
            </div>
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.5em]">Secret Identity</h2>
          </div>

          <div className="space-y-2">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Pass the phone to</p>
            <h3 className="text-5xl font-black text-white tracking-tighter">{currentPlayer.name}</h3>
          </div>

          <Button variant="primary" size="lg" onClick={confirmPass} className="w-full py-6 rounded-[2rem] text-xl">
             I am {currentPlayer.name} <ArrowRight className="w-6 h-6" />
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === GameStatus.REVEALING) {
    const currentPlayer = state.players[state.currentPlayerIndex];
    const isImpostor = currentPlayer.role === 'impostor';
    
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 select-none">
        <div className="max-w-md w-full space-y-12 text-center animate-in fade-in duration-300">
           <div className="space-y-2">
              <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">Private Reveal</p>
              <h2 className="text-2xl font-black">{currentPlayer.name}</h2>
           </div>

           <div className="relative group">
              <button 
                onMouseDown={() => setIsHolding(true)}
                onMouseUp={() => setIsHolding(false)}
                onTouchStart={() => setIsHolding(true)}
                onTouchEnd={() => setIsHolding(false)}
                className={`w-full aspect-square rounded-[3rem] border-4 transition-all duration-300 flex flex-col items-center justify-center gap-6 ${isHolding ? 'bg-slate-800 border-slate-400' : 'bg-slate-900 border-slate-700 border-dashed'}`}
              >
                {isHolding ? (
                  <>
                    <div className="space-y-1 animate-in zoom-in-95 duration-200">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Your Role</p>
                      <h4 className={`text-4xl font-black italic ${isImpostor ? 'text-rose-500' : 'text-cyan-400'}`}>
                        {isImpostor ? 'IMPOSTOR' : 'INNOCENT'}
                      </h4>
                    </div>
                    <div className="space-y-1 animate-in zoom-in-95 duration-300">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Secret Word</p>
                      <h4 className="text-4xl font-black text-white uppercase">
                        {isImpostor ? '???' : state.roundData?.topic}
                      </h4>
                    </div>
                  </>
                ) : (
                  <>
                    <Eye className="w-16 h-16 text-slate-700" />
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-600">Hold to Peek</p>
                  </>
                )}
              </button>
           </div>

           <Button 
            variant="secondary" 
            className="w-full py-4 rounded-2xl" 
            onClick={finishReveal}
            disabled={isHolding}
           >
             I've Seen My Identity
           </Button>
        </div>
      </div>
    );
  }

  if (state.status === GameStatus.PLAYING) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4">
        <div className="w-full max-w-md flex justify-between items-center mb-12 mt-4">
           <h1 className="text-2xl font-black italic tracking-tighter text-cyan-400">MISSION ACTIVE</h1>
           <Button variant="ghost" size="sm" onClick={resetToSetup} className="text-[10px] font-black uppercase">
             <RefreshCw className="w-3 h-3" /> New Game
           </Button>
        </div>

        <div className="max-w-md w-full space-y-12 animate-in slide-in-from-bottom-8 duration-700">
           <Card className="text-center space-y-4 border-2 border-slate-700">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Current Category</p>
                <h2 className="text-5xl font-black text-white tracking-tight uppercase">{state.roundData?.category}</h2>
              </div>
           </Card>

           <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                 <Users className="w-4 h-4 text-slate-500" />
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Players</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {state.players.map(p => (
                  <div key={p.id} className="p-4 bg-slate-800 rounded-2xl border border-slate-700 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center font-black text-sm text-slate-400">
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-200 truncate">{p.name}</span>
                  </div>
                ))}
              </div>
           </div>

           <div className="p-6 bg-cyan-500/10 rounded-[2rem] border border-cyan-500/20 text-center space-y-4">
              <div className="flex justify-center">
                 <Clock className="w-8 h-8 text-cyan-400 animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-cyan-400 leading-relaxed">
                  Start the discussion! Ask questions to reveal the impostor without letting them guess the word.
                </p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Impostors: {state.impostorCount}
                </p>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
