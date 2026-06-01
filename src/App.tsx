/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, RotateCcw, Info, Ghost, LogIn, LogOut, User as UserIcon, Search, Medal, Heart, X, ChevronLeft, ChevronRight, Target, Hand, Sparkles, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, FirebaseUser, doc, setDoc, getDoc, updateDoc, collection, query, orderBy, limit, getDocs, where, runTransaction, getDocFromServer, handleFirestoreError, OperationType, browserPopupRedirectResolver } from './firebase';

// --- Constants & Types ---

type CardValue = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface Card {
  id: string;
  value: CardValue;
}

interface Player {
  id: number;
  name: string;
  score: number;
  setasCount: number;
  drawPile: Card[];
  discardPile: Card[];
  color: string;
  voidSacrifices: number;
  lastVoidUnlockScore: number;
  uid?: string;
  hearts: number;
}

type GameState = 'loading' | 'auth' | 'naming' | 'start' | 'setup' | 'countdown' | 'playing' | 'gameover' | 'leaderboard';
type PendingAction = 'claim' | 'setas' | 'wrongMath' | 'wrongSetas' | null;
type Difficulty = 'easy' | 'normal' | 'hard';

interface UserStats {
  setas: number;
  points: number;
  wins: number;
}

interface UserProfile {
  uid: string;
  displayName: string;
  stats: {
    easy: UserStats;
    normal: UserStats;
    hard: UserStats;
    medium?: UserStats;
  };
}

const AI_STATS: Record<Difficulty, {
  name: string;
  speed: string;
  sacrifice: string;
  description: string;
  color: string;
}> = {
  easy: {
    name: "The Whisper",
    speed: "1.0s - 2.0s",
    sacrifice: "Low",
    description: "A faint echo. 7 Hearts to survive.",
    color: "text-blue-400"
  },
  normal: {
    name: "The Shadow",
    speed: "0.75s - 1.5s",
    sacrifice: "Moderate",
    description: "A steady presence. 5 Hearts to survive.",
    color: "text-purple-400"
  },
  hard: {
    name: "The Ancient",
    speed: "0.5s - 1.2s",
    sacrifice: "Strategic",
    description: "The Forest itself. Only 3 Hearts.",
    color: "text-red-400"
  }
};

const CARD_DISTRIBUTION: Record<string, number> = {
  '1': 17,
  '2': 13,
  '3': 11,
  '4': 7,
  '5': 7,
  '6': 2,
  '7': 2,
  '0': 5,
  '-1': 3,
};

const ASSETS = {
  cardBack: '/images/card-back.png',
  coin6: '/images/token-6.png',
  coin7: '/images/token-7.png',
  cards: {
    '-1': '/images/card--1.png',
    0: '/images/card-0.png',
    1: '/images/card-1.png',
    2: '/images/card-2.png',
    3: '/images/card-3.png',
    4: '/images/card-4.png',
    5: '/images/card-5.png',
    6: '/images/card-6.png',
    7: '/images/card-7.png',
  } as Record<string, string>,
  title: '/images/cover.png',
  startScreen: '/images/cover.png',
  loading: '/images/cover.png',
};

const COUNTDOWN_SEQUENCE = ['6', '7', '13', 'GO!'];

const PLAYER_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];

// --- Helper Functions ---

const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const generateDeck = (): Card[] => {
  const deck: Card[] = [];
  Object.entries(CARD_DISTRIBUTION).forEach(([val, count]) => {
    for (let i = 0; i < count; i++) {
      deck.push({ id: `${val}-${i}-${Date.now()}-${Math.random()}`, value: parseInt(val) as CardValue });
    }
  });
  return shuffle(deck);
};

// --- Main Component ---

// --- Help Modal Component ---
interface HelpModalProps {
  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
  currentHelpSlide: number;
  setCurrentHelpSlide: React.Dispatch<React.SetStateAction<number>>;
}

const HelpModal: React.FC<HelpModalProps> = ({ showHelp, setShowHelp, currentHelpSlide, setCurrentHelpSlide }) => {
  return (
    <AnimatePresence>
      {showHelp && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center backdrop-blur-2xl p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-black/60 border border-white/20 rounded-[2.5rem] p-8 md:p-12 max-w-lg w-full shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />
            
            <button 
              onClick={() => {
                setShowHelp(false);
                setCurrentHelpSlide(0);
              }}
              className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <X className="w-6 h-6 text-white/40" />
            </button>

            <div className="flex flex-col items-center text-center min-h-[300px] justify-center mt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentHelpSlide}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6 shadow-lg border border-white/10">
                    {currentHelpSlide === 0 && <Target className="w-10 h-10 text-yellow-400" />}
                    {currentHelpSlide === 1 && <Hand className="w-10 h-10 text-green-400" />}
                    {currentHelpSlide === 2 && <Sparkles className="w-10 h-10 text-purple-400" />}
                    {currentHelpSlide === 3 && <Ghost className="w-10 h-10 text-blue-400" />}
                    {currentHelpSlide === 4 && <Heart className="w-10 h-10 text-red-400" />}
                  </div>
                  <h2 className={`text-3xl font-serif italic mb-4 text-transparent bg-clip-text bg-gradient-to-r ${
                    currentHelpSlide === 0 ? 'from-yellow-200 to-yellow-500' :
                    currentHelpSlide === 1 ? 'from-green-200 to-green-500' :
                    currentHelpSlide === 2 ? 'from-purple-200 to-purple-500' :
                    currentHelpSlide === 3 ? 'from-blue-200 to-blue-500' :
                    'from-red-200 to-red-500'
                  }`}>
                    {currentHelpSlide === 0 && "The Goal"}
                    {currentHelpSlide === 1 && "Claiming"}
                    {currentHelpSlide === 2 && "Setas (13)"}
                    {currentHelpSlide === 3 && "The Void"}
                    {currentHelpSlide === 4 && "Penalties"}
                  </h2>
                  <p className="text-base text-green-100/80 leading-relaxed max-w-sm">
                    {currentHelpSlide === 0 && "Watch the Target Coin (6 or 7). Be the first to claim when cards match the target value."}
                    {currentHelpSlide === 1 && "If 1 or 2 of the top cards (active cards) add up to the Target Coin, press CLAIM! Correct claims win the round."}
                    {currentHelpSlide === 2 && "If 2 or 3 cards (including the Void card) add up to exactly 13, press SETAS! (or 'M' on PC) for a 130 point bonus."}
                    {currentHelpSlide === 3 && "The central pile where cards are sacrificed. Its top card counts toward Setas! combinations."}
                    {currentHelpSlide === 4 && "False calls cost a Heart. Lose all hearts and you're out. Stay sharp!"}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between mt-8">
              <button 
                onClick={() => setCurrentHelpSlide(prev => Math.max(0, prev - 1))}
                disabled={currentHelpSlide === 0}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>

              <div className="flex gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div 
                    key={i} 
                    className={`w-2 h-2 rounded-full transition-all ${i === currentHelpSlide ? 'bg-yellow-400 w-6' : 'bg-white/20'}`}
                  />
                ))}
              </div>

              <button 
                onClick={() => {
                  if (currentHelpSlide === 4) {
                    setShowHelp(false);
                    setCurrentHelpSlide(0);
                  } else {
                    setCurrentHelpSlide(prev => Math.min(4, prev + 1));
                  }
                }}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all"
              >
                {currentHelpSlide === 4 ? (
                  <span className="px-4 font-bold text-sm text-white">Play</span>
                ) : (
                  <ChevronRight className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('loading');
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [players, setPlayers] = useState<Player[]>([]);
  const [targetCoin, setTargetCoin] = useState<6 | 7>(6);
  const [bankMarks, setBankMarks] = useState<number>(67);
  const [voidPile, setVoidPile] = useState<Card[]>([]);
  const [lastAction, setLastAction] = useState<string>('');
  const [winner, setWinner] = useState<Player | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isAiGame, setIsAiGame] = useState<boolean>(false);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>('normal');
  const [turn, setTurn] = useState<number>(0);
  const [aiThinking, setAiThinking] = useState<boolean>(false);
  const hasSavedStats = useRef<boolean>(false);
  const isProcessingAction = useRef<boolean>(false);
  const [isAutoplay, setIsAutoplay] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(0);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [currentHelpSlide, setCurrentHelpSlide] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lobbyAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isMusicMuted, setIsMusicMuted] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // Auth & Profile State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [leaderboardDifficulty, setLeaderboardDifficulty] = useState<Difficulty>('normal');
  const [leaderboardSort, setLeaderboardSort] = useState<'setas' | 'points' | 'wins'>('wins');

  // Audio setup
  useEffect(() => {
    audioRef.current = new Audio('/Chasing_Golden_Caps.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 0.4;

    lobbyAudioRef.current = new Audio('/Treasures_in_the_Clearing.mp3');
    lobbyAudioRef.current.loop = true;
    lobbyAudioRef.current.volume = 0.4;

    const handleInteraction = () => {
      setHasInteracted(true);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };

    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (lobbyAudioRef.current) {
        lobbyAudioRef.current.pause();
        lobbyAudioRef.current = null;
      }
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // Audio playback control
  useEffect(() => {
    if (!audioRef.current || !lobbyAudioRef.current) return;

    if (isMusicMuted || !hasInteracted) {
      audioRef.current.pause();
      lobbyAudioRef.current.pause();
      return;
    }

    if (gameState === 'playing' && isAiGame) {
      lobbyAudioRef.current.pause();
      audioRef.current.play().catch(e => console.error("Audio play failed:", e));
    } else if (gameState === 'start' || gameState === 'setup' || gameState === 'gameover' || (gameState === 'playing' && !isAiGame)) {
      audioRef.current.pause();
      lobbyAudioRef.current.play().catch(e => console.error("Lobby audio play failed:", e));
    } else {
      audioRef.current.pause();
      lobbyAudioRef.current.pause();
    }
  }, [gameState, isAiGame, isMusicMuted, hasInteracted]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const docRef = doc(db, 'players_v1', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
            setGameState('start');
          } else {
            setGameState('naming');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `players_v1/${u.uid}`);
        }
      } else {
        setGameState('auth');
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (gameState === 'loading' && isAuthReady) {
      if (!user) {
        setGameState('auth');
      } else if (profile) {
        setGameState('start');
      } else {
        setGameState('naming');
      }
    }
  }, [gameState, isAuthReady, user, profile]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError('Popup blocked by browser. Please allow popups for this site.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        setAuthError('Login request was cancelled. Please try again.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setAuthError('Login window was closed before completion.');
      } else {
        setAuthError('An unexpected error occurred during login.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setGameState('auth');
    setProfile(null);
  };

  const checkUsername = async (name: string) => {
    if (name.length < 3) {
      setUsernameError('Name too short');
      return false;
    }
    setIsCheckingUsername(true);
    try {
      const docRef = doc(db, 'usernames', name.toLowerCase());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUsernameError('Name already taken');
        return false;
      }
      setUsernameError('');
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `usernames/${name.toLowerCase()}`);
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    const isAvailable = await checkUsername(usernameInput);
    if (!isAvailable) return;

    const newProfile: UserProfile = {
      uid: user.uid,
      displayName: usernameInput,
      stats: {
        easy: { setas: 0, points: 0, wins: 0 },
        normal: { setas: 0, points: 0, wins: 0 },
        hard: { setas: 0, points: 0, wins: 0 }
      }
    };

    try {
      await runTransaction(db, async (transaction) => {
        transaction.set(doc(db, 'players_v1', user.uid), newProfile);
        transaction.set(doc(db, 'usernames', usernameInput.toLowerCase()), { uid: user.uid });
      });
      setProfile(newProfile);
      setGameState('start');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'players_v1/usernames');
    }
  };

  const fetchLeaderboard = async (diff: Difficulty, sortBy: 'setas' | 'points' | 'wins' = leaderboardSort) => {
    setLeaderboardDifficulty(diff);
    setLeaderboardSort(sortBy);
    try {
      // Fetch all players to correctly merge 'medium' into 'normal' for older players
      const q = query(collection(db, 'players_v1'));
      const querySnapshot = await getDocs(q);
      const results: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        results.push(doc.data() as UserProfile);
      });

      // Sort client-side
      results.sort((a, b) => {
        const statA = a.stats[diff] || (diff === 'normal' ? a.stats.medium : null) || { setas: 0, points: 0, wins: 0 };
        const statB = b.stats[diff] || (diff === 'normal' ? b.stats.medium : null) || { setas: 0, points: 0, wins: 0 };
        
        const valA = statA[sortBy] ?? 0;
        const valB = statB[sortBy] ?? 0;
        
        if (valB !== valA) {
          return valB - valA;
        }
        // Tie-breaker
        const tieBreaker = sortBy === 'wins' ? 'points' : sortBy === 'setas' ? 'points' : 'setas';
        const tieA = statA[tieBreaker] ?? 0;
        const tieB = statB[tieBreaker] ?? 0;
        return tieB - tieA;
      });

      // Take top 20
      setLeaderboard(results.slice(0, 20));
      setGameState('leaderboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'players_v1');
    }
  };

  const initGame = (count: number, ai: boolean = false, difficulty: Difficulty = 'normal') => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    
    const deck = generateDeck();
    const newPlayers: Player[] = [];
    const cardsPerPlayer = Math.floor(deck.length / count);
    const initialHearts = difficulty === 'easy' ? 7 : difficulty === 'normal' ? 5 : 3;

    for (let i = 0; i < count; i++) {
      newPlayers.push({
        id: i,
        name: ai && i === 1 ? `AI (${difficulty.toUpperCase()})` : (i === 0 && profile ? profile.displayName : `Player ${i + 1}`),
        score: 0,
        setasCount: 0,
        drawPile: deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer),
        discardPile: [],
        color: PLAYER_COLORS[i],
        voidSacrifices: 0,
        lastVoidUnlockScore: 0,
        uid: i === 0 && user ? user.uid : undefined,
        hearts: initialHearts
      });
    }

    // Law of 6-7: Extra cards to someone
    const remaining = deck.length % count;
    if (remaining > 0) {
      for (let i = 0; i < remaining; i++) {
        newPlayers[i].drawPile.push(deck[deck.length - 1 - i]);
      }
    }

    setPlayers(newPlayers);
    setPlayerCount(count);
    setIsAiGame(ai);
    setAiDifficulty(difficulty);
    setTurn(0);
    setBankMarks(67);
    setTargetCoin(6);
    setVoidPile([]);
    hasSavedStats.current = false;
    setIsAutoplay(true);
    setCountdown(0);
    setGameState('countdown');
    setLastAction('Game Started! Target: 6');
  };

  const reshuffleAll = useCallback(() => {
    setPlayers(prev => {
      const allCards: Card[] = [];
      prev.forEach(p => {
        allCards.push(...p.drawPile, ...p.discardPile);
      });
      
      const shuffled = shuffle(allCards);
      const cardsPerPlayer = Math.floor(shuffled.length / prev.length);
      
      return prev.map((p, i) => ({
        ...p,
        drawPile: shuffled.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer),
        discardPile: [],
      }));
    });
    setLastAction('The Great Reshuffle!');
  }, []);

  const handleDraw = useCallback((playerIndex: number) => {
    const player = players[playerIndex];
    if (!player || player.drawPile.length === 0) return;

    const card = player.drawPile[0];
    const willBeEmpty = player.drawPile.length === 1;

    setPlayers(prev => {
      const newPlayers = [...prev];
      const p = newPlayers[playerIndex];
      newPlayers[playerIndex] = {
        ...p,
        drawPile: p.drawPile.slice(1),
        discardPile: [card, ...p.discardPile],
      };
      return newPlayers;
    });

    if (willBeEmpty) {
      setTimeout(reshuffleAll, 500);
    }
    setTurn(t => (t + 1) % playerCount);
  }, [reshuffleAll, playerCount, players]);

  const checkVoidUnlocks = (player: Player): Player => {
    let sacrifices = player.voidSacrifices;
    let lastUnlock = player.lastVoidUnlockScore;

    if (player.score >= 200 && lastUnlock < 200) {
      sacrifices += 1;
      lastUnlock = 200;
    } else if (player.score >= 140 && lastUnlock < 140) {
      sacrifices += 1;
      lastUnlock = 140;
    } else if (player.score >= 60 && lastUnlock < 60) {
      sacrifices += 1;
      lastUnlock = 60;
    }

    return { ...player, voidSacrifices: sacrifices, lastVoidUnlockScore: lastUnlock };
  };

  const handleSacrifice = useCallback((playerIndex: number) => {
    if (playerCount !== 2) return;
    
    const player = players[playerIndex];
    if (!player || player.discardPile.length < 1 || player.voidSacrifices === 0) return;

    const topCard = player.discardPile[0];
    
    setVoidPile(v => [...v, topCard]);
    setPlayers(prev => {
      const newPlayers = [...prev];
      const p = newPlayers[playerIndex];
      
      newPlayers[playerIndex] = {
        ...p,
        voidSacrifices: p.voidSacrifices - 1,
        discardPile: p.discardPile.slice(1),
      };
      return newPlayers;
    });
    
    setTurn(t => (t + 1) % playerCount);
    setLastAction(`P${playerIndex + 1} Sacrificed to Void!`);
  }, [playerCount, players]);

  const getSum = useCallback((includeVoid: boolean) => {
    let sum = players.reduce((acc, p) => acc + (p.discardPile[0]?.value || 0), 0);
    if (includeVoid && voidPile.length > 0) {
      sum += voidPile[voidPile.length - 1].value;
    }
    return sum;
  }, [players, voidPile]);

  const handleWrongMath = useCallback((playerIndex: number) => {
    setPlayers(prev => {
      const newPlayers = prev.map((p, i) => {
        if (i === playerIndex) {
          const newHearts = Math.max(0, p.hearts - 1);
          return { ...p, hearts: newHearts };
        }
        return p;
      });
      return newPlayers;
    });
    setLastAction(`P${playerIndex + 1} Wrong Math Call! (-1 Heart)`);
    setPendingAction(null);
  }, []);

  const handleWrongSetas = useCallback((playerIndex: number) => {
    setPlayers(prev => {
      const newPlayers = prev.map((p, i) => {
        if (i === playerIndex) {
          const newHearts = Math.max(0, p.hearts - 1);
          return { ...p, hearts: newHearts };
        }
        return p;
      });
      return newPlayers;
    });
    setLastAction(`P${playerIndex + 1} Wrong Setas! (-1 Heart)`);
    setPendingAction(null);
  }, []);

  const checkClaim = useCallback(() => {
    const currentSum = getSum(false);
    const hasMatchingCard = players.some(p => p.discardPile[0]?.value === targetCoin);
    return currentSum === targetCoin || hasMatchingCard;
  }, [getSum, players, targetCoin]);

  const checkSetas = useCallback(() => {
    if (playerCount !== 2) return false;
    const p1Val = players[0]?.discardPile[0]?.value || 0;
    const p2Val = players[1]?.discardPile[0]?.value || 0;
    const voidVal = voidPile.length > 0 ? voidPile[voidPile.length - 1].value : 0;

    // Check all combinations of 2 or 3 cards
    const combinations = [
      p1Val + p2Val,
      p1Val + voidVal,
      p2Val + voidVal,
      p1Val + p2Val + voidVal
    ];

    return combinations.some(sum => sum === 13);
  }, [players, voidPile, playerCount]);

  const handleSetas = useCallback((playerIndex: number) => {
    if (isProcessingAction.current) return;
    if (!checkSetas()) {
      handleWrongSetas(playerIndex);
      return;
    }

    isProcessingAction.current = true;
    setPlayers(prev => prev.map((p, i) => {
      const updatedPlayer = i === playerIndex ? { ...p, score: p.score + 130, setasCount: (p.setasCount || 0) + 1 } : p;
      return i === playerIndex ? checkVoidUnlocks(updatedPlayer) : updatedPlayer;
    }));
    setTurn(playerIndex);
    setLastAction(`P${playerIndex + 1} TRUE SETAS! (+130)`);
    setGameState('gameover');
    setPendingAction(null);
    
    setTimeout(() => {
      isProcessingAction.current = false;
    }, 1000);
  }, [checkSetas, handleWrongSetas]);

  const handleClaim = useCallback((playerIndex: number) => {
    if (isProcessingAction.current) return;
    
    // If it's a SETAS (13), you MUST click SETAS, not CLAIM.
    if (checkSetas()) {
      handleWrongMath(playerIndex);
      return;
    }

    if (!checkClaim()) {
      handleWrongMath(playerIndex);
      return;
    }

    isProcessingAction.current = true;
    if (bankMarks > 0) {
      setBankMarks(b => b - 1);
      setPlayers(prev => {
        const allDiscardedCards = prev.flatMap(p => p.discardPile);
        return prev.map((p, i) => {
          const updatedPlayer = {
            ...p,
            score: i === playerIndex ? p.score + 10 : p.score,
            drawPile: i === playerIndex ? [...p.drawPile, ...allDiscardedCards] : p.drawPile,
            discardPile: [],
          };
          return i === playerIndex ? checkVoidUnlocks(updatedPlayer) : updatedPlayer;
        });
      });
      
      setTargetCoin(t => (t === 6 ? 7 : 6));
      setTurn(playerIndex);
      setLastAction(`P${playerIndex + 1} Won Round! (+10) Target is now ${targetCoin === 6 ? 7 : 6}`);
    }

    if (bankMarks <= 1) {
      setGameState('gameover');
    }
    setPendingAction(null);
    
    setTimeout(() => {
      isProcessingAction.current = false;
    }, 500);
  }, [targetCoin, bankMarks, checkClaim, handleWrongMath, checkSetas, handleSetas]);

  useEffect(() => {
    if (gameState === 'gameover' && players.length > 0 && !hasSavedStats.current) {
      const sorted = [...players].sort((a, b) => {
        // Players with 0 hearts lose regardless of score
        if (a.hearts <= 0 && b.hearts > 0) return 1;
        if (b.hearts <= 0 && a.hearts > 0) return -1;
        return b.score - a.score;
      });
      const winnerPlayer = sorted[0];
      setWinner(winnerPlayer);

      // Save stats to Firestore if it's an AI game and we have a profile
      if (isAiGame && profile && user) {
        hasSavedStats.current = true;
        const playerInGame = players.find(p => p.uid === user.uid);
        if (playerInGame) {
          const isWinner = winnerPlayer.uid === user.uid;
          const currentStats = profile.stats[aiDifficulty] || (aiDifficulty === 'normal' ? profile.stats.medium : null) || { setas: 0, points: 0, wins: 0 };
          
          const updatedProfile = {
            ...profile,
            stats: {
              ...profile.stats,
              [aiDifficulty]: {
                setas: currentStats.setas + (playerInGame.setasCount || 0),
                points: currentStats.points + playerInGame.score,
                wins: (currentStats.wins || 0) + (isWinner ? 1 : 0)
              }
            }
          };

          updateDoc(doc(db, 'players_v1', user.uid), {
            stats: updatedProfile.stats
          }).then(() => {
            setProfile(updatedProfile);
          }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `players_v1/${user.uid}`));
        }
      }
    }
  }, [gameState, players, isAiGame, aiDifficulty, profile, user]);

  // Countdown logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'countdown') {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev >= COUNTDOWN_SEQUENCE.length - 1) {
            clearInterval(timer);
            setGameState('playing');
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState]);

  // Check for game over due to hearts
  useEffect(() => {
    if (gameState === 'playing' && players.some(p => p.hearts <= 0)) {
      setGameState('gameover');
    }
  }, [players, gameState]);

  // AI Opponent Logic
  useEffect(() => {
    if (!isAiGame || gameState !== 'playing' || playerCount !== 2) return;

    const aiIndex = 1;
    const playerIndex = 0;

    // Helper to get current sum
    const isClaim = checkClaim();
    const isSetas = checkSetas();

    // AI Speed (Reaction & Thinking)
    const getSpeedDelay = () => {
      if (aiDifficulty === 'easy') return Math.random() * 600 + 1300; // 1.3s - 1.9s
      if (aiDifficulty === 'normal') return Math.random() * 600 + 1100; // 1.1s - 1.7s
      return Math.random() * 600 + 700; // 0.7s - 1.3s
    };

    // 1. Check for 6/7 or SETAS
    let reactionTimer: NodeJS.Timeout;
    let drawTimer: NodeJS.Timeout;

    if (isClaim || isSetas) {
      reactionTimer = setTimeout(() => {
        if (gameState === 'playing' && !pendingAction) {
          // Re-check conditions after delay to avoid race conditions
          const stillSetas = checkSetas();
          const stillClaim = checkClaim();
          
          if (stillSetas) handleSetas(aiIndex);
          else if (stillClaim) handleClaim(aiIndex);
        }
      }, getSpeedDelay());
    } else if (turn === aiIndex && !pendingAction) {
      // 2. AI Turn to Draw or Sacrifice
      setAiThinking(true);
      
      const drawDelay = getSpeedDelay();
      drawTimer = setTimeout(() => {
        setAiThinking(false);
        if (gameState === 'playing' && turn === aiIndex) {
          // AI Sacrifice Algorithm
          const aiPlayer = players[aiIndex];
          const humanPlayer = players[0];
          
          let sacrificeChance = 0;
          
          if (aiPlayer.discardPile.length >= 2 && (aiPlayer.score >= 50 || aiPlayer.voidSacrifices > 0)) {
            const aiCard = parseInt(aiPlayer.discardPile[0].value);
            const humanCard = humanPlayer.discardPile.length > 0 ? parseInt(humanPlayer.discardPile[0].value) : 0;
            const voidCard = voidPile.length > 0 ? parseInt(voidPile[voidPile.length - 1].value) : 0;
            
            // 1. High value card on top (10, J, Q, K) - Get rid of it!
            if (aiCard >= 10) sacrificeChance += 0.35;
            
            // 2. Random Chaos (Offensive)
            // Sacrifice randomly to create complexity and hope the player misses a 13
            sacrificeChance += 0.15;
            
            // 3. Defensive Overwrite (Disrupting the Opponent)
            if (humanCard + voidCard === 11 || humanCard + voidCard === 12) {
              sacrificeChance += 0.30;
            }
            
            // 4. Board Unclogging (Stagnant Game)
            if (aiCard >= 5 && humanCard >= 5 && voidCard >= 5) {
              sacrificeChance += 0.20;
            }
            
            // 5. Desperation (Score Differential)
            if (humanPlayer.score - aiPlayer.score >= 50) {
              sacrificeChance += 0.25;
            }
            
            // 6. Difficulty Scaling
            const difficultyMultiplier = aiDifficulty === 'hard' ? 1.2 : aiDifficulty === 'normal' ? 0.6 : 0.1;
            sacrificeChance *= difficultyMultiplier;
          }

          if (sacrificeChance > 0 && Math.random() < sacrificeChance) {
            handleSacrifice(aiIndex);
          } else {
            handleDraw(aiIndex);
          }
        }
      }, drawDelay);
    }

    return () => {
      clearTimeout(reactionTimer);
      clearTimeout(drawTimer);
    };
  }, [isAiGame, gameState, players, targetCoin, turn, aiDifficulty, pendingAction, handleClaim, handleSetas, handleDraw, handleSacrifice, playerCount, voidPile, checkClaim, checkSetas]);

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;

      const key = e.key.toUpperCase();

      if (pendingAction) {
        const playerIndex = parseInt(key) - 1;
        if (playerIndex >= 0 && playerIndex < playerCount) {
          if (pendingAction === 'claim') handleClaim(playerIndex);
          if (pendingAction === 'setas') handleSetas(playerIndex);
          if (pendingAction === 'wrongMath') handleWrongMath(playerIndex);
          if (pendingAction === 'wrongSetas') handleWrongSetas(playerIndex);
        } else if (e.key === 'Escape') {
          setPendingAction(null);
        }
        return;
      }

      if (playerCount === 2) {
        if (key === 'V') {
          if (isAiGame && turn !== 0) return;
          handleSacrifice(0);
        }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (isAiGame) {
          handleClaim(0);
        } else {
          setPendingAction('claim');
        }
        return;
      }

      if (key === 'M') {
        if (isAiGame) {
          handleSetas(0);
        } else {
          setPendingAction('setas');
        }
        return;
      }

      if (key === 'R') {
        if (isAiGame) {
          handleWrongMath(0);
        } else {
          setPendingAction('wrongMath');
        }
      }
      if (key === 'Y') {
        if (isAiGame) {
          handleWrongSetas(0);
        } else {
          setPendingAction('wrongSetas');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, playerCount, pendingAction, handleDraw, handleSacrifice, handleClaim, handleSetas, handleWrongMath, handleWrongSetas, isAiGame, turn, checkSetas]);

  // Autoplay Logic for Player
  useEffect(() => {
    if (!isAutoplay || gameState !== 'playing' || turn !== 0 || !isAiGame || pendingAction) return;

    const getPlayerAutoplayDelay = () => {
      const baseDelay = aiDifficulty === 'easy' ? 1500 : aiDifficulty === 'normal' ? 1125 : 850;
      return baseDelay / 1.3;
    };

    const timer = setTimeout(() => {
      if (gameState === 'playing' && turn === 0) {
        if (!checkSetas() && !checkClaim()) {
          handleDraw(0);
        }
      }
    }, getPlayerAutoplayDelay());

    return () => clearTimeout(timer);
  }, [isAutoplay, gameState, turn, isAiGame, aiDifficulty, pendingAction, handleDraw, checkClaim, checkSetas, handleClaim, handleSetas]);

  if (gameState === 'loading') {
    return (
      <div 
        className="fixed inset-0 flex flex-col items-center justify-center text-white overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2560&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1 }}
          className="relative z-10 text-center px-4"
        >
          <div className="max-w-2xl mx-auto mb-12 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.4)] border border-white/20">
            <img 
              src={ASSETS.loading} 
              alt="Seis Siete Setas" 
              className="w-full h-auto"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = ASSETS.cardBack;
              }}
            />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter italic font-serif mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-green-400 to-emerald-600 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
            SEIS. SIETE. SETAS.
          </h1>
          <p className="text-xl opacity-80 font-mono tracking-widest uppercase text-green-200">Loading the Forest...</p>
          <div className="mt-8 w-64 h-1 bg-black/50 backdrop-blur-md rounded-full overflow-hidden mx-auto border border-white/10">
            <motion.div 
              className="h-full bg-gradient-to-r from-green-400 to-yellow-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 2.5 }}
            />
          </div>
        </motion.div>
        <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-screen">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-600 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
      </div>
    );
  }

  if (gameState === 'auth') {
    return (
      <div 
        className="fixed inset-0 flex flex-col items-center justify-center text-white overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2560&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 text-center px-4 max-w-md w-full"
        >
          <div className="mb-8 p-6 bg-black/40 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl">
            <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-3xl font-serif italic mb-2 text-yellow-200">Welcome to the Forest</h1>
            <p className="text-sm text-green-100/60 mb-8 font-mono">Sign in to track your wins and climb the leaderboard.</p>
            
            {authError && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/40 rounded-xl text-red-200 text-xs font-mono">
                {authError}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-4 rounded-xl hover:bg-yellow-100 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'naming') {
    return (
      <div 
        className="fixed inset-0 flex flex-col items-center justify-center text-white overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2560&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative z-10 text-center px-4 max-w-md w-full"
        >
          <div className="mb-8 p-8 bg-black/40 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl">
            <UserIcon className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-3xl font-serif italic mb-2 text-green-200">Claim Your Name</h1>
            <p className="text-sm text-green-100/60 mb-8 font-mono">Choose a unique name for the leaderboard.</p>
            
            <div className="relative mb-6">
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter username..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-white font-bold focus:outline-none focus:border-yellow-400/50 transition-all"
              />
              {isCheckingUsername && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            {usernameError && (
              <p className="text-red-400 text-xs mb-6 font-mono">{usernameError}</p>
            )}

            <button
              onClick={saveProfile}
              disabled={isCheckingUsername || usernameInput.length < 3}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg disabled:opacity-50"
            >
              Continue to the Forest
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'leaderboard') {
    return (
      <div 
        className="min-h-screen text-white flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2560&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="max-w-4xl w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 sm:p-10 shadow-[0_0_80px_rgba(0,0,0,0.8)] relative z-10 flex flex-col max-h-[90vh]"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />
          
          <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                <Medal className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-3xl font-serif italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-yellow-500 drop-shadow-md">
                  Hall of Champions
                </h2>
                <p className="text-[10px] text-yellow-200/60 font-mono uppercase tracking-widest mt-1">
                  The greatest wanderers of the forest
                </p>
              </div>
            </div>
            <button 
              onClick={() => setGameState('setup')}
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300"
            >
              Return
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            {/* Difficulty Tabs */}
            <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-md flex-1">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => fetchLeaderboard(d, leaderboardSort)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                    leaderboardDifficulty === d 
                      ? 'bg-gradient-to-br from-yellow-600/80 to-amber-800/80 text-white shadow-[0_0_20px_rgba(234,179,8,0.3)] border border-yellow-400/30' 
                      : 'hover:bg-white/5 text-white/40 border border-transparent hover:border-white/10'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Sort Tabs */}
            <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-md overflow-x-auto custom-scrollbar">
              <button
                onClick={() => fetchLeaderboard(leaderboardDifficulty, 'wins')}
                className={`px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                  leaderboardSort === 'wins' 
                    ? 'bg-white/10 text-white border border-white/20' 
                    : 'hover:bg-white/5 text-white/40 border border-transparent hover:border-white/10'
                }`}
              >
                <Trophy className="w-3 h-3" /> Wins
              </button>
              <button
                onClick={() => fetchLeaderboard(leaderboardDifficulty, 'setas')}
                className={`px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                  leaderboardSort === 'setas' 
                    ? 'bg-white/10 text-white border border-white/20' 
                    : 'hover:bg-white/5 text-white/40 border border-transparent hover:border-white/10'
                }`}
              >
                <Trophy className="w-3 h-3" /> Setas
              </button>
              <button
                onClick={() => fetchLeaderboard(leaderboardDifficulty, 'points')}
                className={`px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                  leaderboardSort === 'points' 
                    ? 'bg-white/10 text-white border border-white/20' 
                    : 'hover:bg-white/5 text-white/40 border border-transparent hover:border-white/10'
                }`}
              >
                <Sparkles className="w-3 h-3" /> Points
              </button>
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-[10px] font-mono text-white/40 uppercase tracking-widest mb-2">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-5">Player</div>
            <div className={`col-span-2 text-right transition-colors ${leaderboardSort === 'wins' ? 'text-yellow-400 font-bold' : ''}`}>Wins</div>
            <div className={`col-span-2 text-right transition-colors ${leaderboardSort === 'setas' ? 'text-yellow-400 font-bold' : ''}`}>Setas</div>
            <div className={`col-span-2 text-right transition-colors ${leaderboardSort === 'points' ? 'text-yellow-400 font-bold' : ''}`}>Points</div>
          </div>

          {/* Leaderboard List */}
          <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-[300px]">
            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/30 font-mono text-sm uppercase tracking-widest">
                <Ghost className="w-12 h-12 mb-4 opacity-20" />
                No champions found
              </div>
            ) : (
              leaderboard.map((p, i) => {
                const stat = p.stats[leaderboardDifficulty] || (leaderboardDifficulty === 'normal' ? p.stats.medium : null) || { setas: 0, points: 0 };
                
                let rankStyle = "text-white/40";
                let rowStyle = "bg-white/5 border-white/5 hover:bg-white/10";
                let CrownIcon = null;

                if (i === 0) {
                  rankStyle = "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]";
                  rowStyle = "bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30";
                  CrownIcon = <Trophy className="w-4 h-4 text-yellow-400" />;
                } else if (i === 1) {
                  rankStyle = "text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.8)]";
                  rowStyle = "bg-gradient-to-r from-slate-400/10 to-transparent border-slate-400/30";
                  CrownIcon = <Trophy className="w-4 h-4 text-slate-300" />;
                } else if (i === 2) {
                  rankStyle = "text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.8)]";
                  rowStyle = "bg-gradient-to-r from-amber-600/10 to-transparent border-amber-600/30";
                  CrownIcon = <Trophy className="w-4 h-4 text-amber-600" />;
                }

                const isCurrentUser = p.uid === user?.uid;
                if (isCurrentUser) {
                  rowStyle += " ring-1 ring-green-500/50 bg-green-500/10";
                }

                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={p.uid} 
                    className={`grid grid-cols-12 gap-2 items-center px-4 py-3 rounded-2xl border transition-all duration-300 ${rowStyle}`}
                  >
                    <div className={`col-span-1 text-center font-mono text-lg font-bold ${rankStyle}`}>
                      {i + 1}
                    </div>
                    
                    <div className="col-span-5 flex items-center gap-2 overflow-hidden">
                      {CrownIcon && <div className="hidden sm:block shrink-0">{CrownIcon}</div>}
                      <span className={`font-bold text-sm truncate ${isCurrentUser ? 'text-green-300' : 'text-white'}`}>
                        {p.displayName}
                      </span>
                      {isCurrentUser && (
                        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-[8px] font-mono text-green-300 uppercase tracking-widest shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    
                    <div className="col-span-2 text-right">
                      <span className={`font-mono text-sm sm:text-base ${leaderboardSort === 'wins' ? 'text-yellow-300 font-bold' : 'text-white/70'}`}>
                        {stat.wins || 0}
                      </span>
                    </div>

                    <div className="col-span-2 text-right">
                      <span className={`font-mono text-sm sm:text-base ${leaderboardSort === 'setas' ? 'text-yellow-300 font-bold' : 'text-white/70'}`}>
                        {stat.setas}
                      </span>
                    </div>
                    
                    <div className="col-span-2 text-right">
                      <span className={`font-mono text-sm sm:text-base ${leaderboardSort === 'points' ? 'text-yellow-300 font-bold' : 'text-white/70'}`}>
                        {stat.points}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'start') {
    return (
      <div 
        className="fixed inset-0 flex flex-col items-center justify-center text-white overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2560&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative z-10 text-center px-4 max-w-4xl"
        >
          <div className="mb-8 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(250,204,21,0.3)] border border-white/20 bg-black/40 backdrop-blur-md">
            <img 
              src={ASSETS.startScreen} 
              alt="Game Start" 
              className="w-full h-auto max-h-[60vh] object-contain mix-blend-screen opacity-90"
              referrerPolicy="no-referrer"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(234,179,8,0.6)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setGameState('setup')}
            className="bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black font-black text-3xl px-16 py-6 rounded-full shadow-[0_0_30px_rgba(234,179,8,0.4)] transition-all uppercase tracking-tighter italic border-2 border-yellow-200/50"
          >
            ENTER THE FOREST
          </motion.button>
        </motion.div>
        <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-screen">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(74,222,128,0.2),transparent_70%)]" />
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-yellow-500/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-emerald-500/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
      </div>
    );
  }

  if (gameState === 'setup') {
    return (
      <div 
        className="min-h-screen text-white flex flex-col items-center justify-center p-8 relative overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2560&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        
        {/* Profile Header */}
        <div className="absolute top-8 right-8 z-20 flex items-center gap-4 bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-lg">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Wanderer</p>
            <p className="font-bold text-green-300">{profile?.displayName}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 bg-white/5 hover:bg-red-500/20 border border-transparent hover:border-red-500/30 rounded-xl transition-all duration-300 group"
            title="Leave the Forest"
          >
            <LogOut className="w-5 h-5 text-white/60 group-hover:text-red-400" />
          </button>
        </div>

        <div className="absolute top-8 left-8 z-20">
          <button 
            onClick={() => fetchLeaderboard('normal')}
            className="flex items-center gap-3 px-6 py-3 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 hover:border-yellow-500/30 rounded-2xl transition-all duration-300 group shadow-lg"
          >
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Medal className="w-4 h-4 text-yellow-400" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-yellow-200">Hall of Champions</span>
          </button>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-3xl w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-[0_0_80px_rgba(0,0,0,0.8)] relative z-10 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-green-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-yellow-500/10 rounded-full blur-[80px] pointer-events-none" />

          <div className="text-center mb-12 relative z-10">
            <h2 className="text-5xl md:text-6xl font-serif italic mb-4 text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 to-yellow-500 drop-shadow-lg">
              Welcome to the Forest
            </h2>
            <p className="text-yellow-200/60 font-mono text-sm tracking-widest uppercase">
              The spirits await your challenge
            </p>
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col gap-8">
              <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-md">
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setAiDifficulty(d)}
                    className={`flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
                      aiDifficulty === d 
                        ? 'bg-gradient-to-br from-green-600/80 to-emerald-800/80 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-green-400/30' 
                        : 'hover:bg-white/5 text-white/40 border border-transparent hover:border-white/10'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              {/* AI Stats Display */}
              <AnimatePresence mode="wait">
                <motion.div 
                  key={aiDifficulty}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-3xl p-6 shadow-inner relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl bg-black/50 flex items-center justify-center border border-white/10 shadow-lg ${AI_STATS[aiDifficulty].color}`}>
                        <Ghost className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className={`font-serif italic text-2xl ${AI_STATS[aiDifficulty].color} drop-shadow-md`}>
                          {AI_STATS[aiDifficulty].name}
                        </h4>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Spectral Opponent</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowHelp(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all group"
                    >
                      <Info className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-white/80">How to Play</span>
                    </button>
                  </div>

                  <p className="text-sm text-white/70 italic mb-6 leading-relaxed border-l-2 border-white/10 pl-4">
                    "{AI_STATS[aiDifficulty].description}"
                  </p>

                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center">
                      <span className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Reaction Speed</span>
                      <span className="text-xs font-bold text-white font-mono">{AI_STATS[aiDifficulty].speed}</span>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center">
                      <span className="text-[9px] text-white/40 uppercase tracking-widest mb-1">Void Sacrifice</span>
                      <span className="text-xs font-bold text-white font-mono">{AI_STATS[aiDifficulty].sacrifice}</span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <button
                onClick={() => initGame(2, true, aiDifficulty)}
                className="group relative bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 border border-green-400/50 rounded-3xl p-6 transition-all duration-300 text-center overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay" />
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black italic uppercase tracking-tighter block mb-1 text-white drop-shadow-md">
                    Face the Forest
                  </span>
                  <span className="text-[10px] text-green-100/70 font-mono uppercase tracking-widest">
                    Begin the Ritual
                  </span>
                </div>
              </button>
            </div>
          </div>


        </motion.div>
        
        {/* Floating particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-yellow-300 rounded-full blur-[2px]"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                opacity: Math.random() * 0.5 + 0.2
              }}
              animate={{
                y: [null, Math.random() * -100 - 50],
                opacity: [null, 0]
              }}
              transition={{
                duration: Math.random() * 5 + 5,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          ))}
        </div>

        <HelpModal 
          showHelp={showHelp} 
          setShowHelp={setShowHelp} 
          currentHelpSlide={currentHelpSlide} 
          setCurrentHelpSlide={setCurrentHelpSlide} 
        />
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div 
        className="min-h-screen text-white flex flex-col items-center justify-center p-8 relative overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2560&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center w-full max-w-lg relative z-10"
        >
          <Trophy className="w-24 h-24 text-yellow-400 mx-auto mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]" />
          <h1 className="text-5xl md:text-6xl font-serif italic mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-500 drop-shadow-lg">
            {winner?.uid === user?.uid ? "You made it out of the forest!" : "Game Over"}
          </h1>
          <p className="text-xl text-white/70 mb-12">
            {winner?.uid === user?.uid ? "You Win!" : "You got lost in the forest."}
          </p>
          <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-3xl p-8 mb-12 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="space-y-4">
              {players.sort((a,b) => b.score - a.score).map((p, i) => (
                <div key={p.id} className="flex justify-between items-center p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 shadow-inner">
                  <span className="font-bold text-white">{i + 1}. {p.name}</span>
                  <span className="font-mono text-xl text-yellow-300">{p.score} pts</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => setGameState('setup')}
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-black font-bold px-8 py-4 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.4)] transition-all mx-auto border border-yellow-200/50"
          >
            <RotateCcw className="w-5 h-5" /> Back to the Forest
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen text-white overflow-hidden flex flex-col relative"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2560&auto=format&fit=crop')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-none" />
      
      <AnimatePresence>
        {gameState === 'countdown' && (
          <motion.div 
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black/40 flex items-center justify-center backdrop-blur-sm"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="text-9xl font-black italic text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)] uppercase tracking-tighter"
            >
              {COUNTDOWN_SEQUENCE[countdown]}
            </motion.div>
          </motion.div>
        )}

        {pendingAction && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-3xl p-6 md:p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            >
              <h2 className="text-2xl md:text-3xl font-serif italic mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-green-400">
                {pendingAction === 'claim' && 'Who Claimed the Round?'}
                {pendingAction === 'setas' && 'Who Called TRUE SETAS?'}
                {pendingAction === 'wrongMath' && 'Who Made a Wrong Math Call?'}
                {pendingAction === 'wrongSetas' && 'Who Called Wrong Setas?'}
              </h2>
              <p className="text-green-100/60 mb-8 text-sm">Select the player to apply points/penalty</p>
              <div className="grid grid-cols-2 gap-4">
                {players.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (pendingAction === 'claim') handleClaim(i);
                      if (pendingAction === 'setas') handleSetas(i);
                      if (pendingAction === 'wrongMath') handleWrongMath(i);
                      if (pendingAction === 'wrongSetas') handleWrongSetas(i);
                    }}
                    className="py-4 px-4 rounded-2xl border border-white/10 hover:border-yellow-400/50 transition-all flex flex-col items-center gap-3 group shadow-lg hover:shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                    style={{ backgroundColor: `${p.color}15` }}
                  >
                    <span className="font-bold text-lg group-hover:scale-110 transition-transform drop-shadow-md" style={{ color: p.color }}>{p.name}</span>
                    <kbd className="hidden xl:inline-block px-3 py-1.5 bg-black/50 rounded-lg text-xs font-mono border border-white/10 text-white/80">Press {i + 1}</kbd>
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setPendingAction(null)}
                className="mt-8 text-xs text-white/40 hover:text-white font-mono transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-2 xl:p-6 flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-white/10 relative z-10 shadow-lg min-h-[80px] xl:min-h-[160px]">
        {/* Left: Bank Status */}
        <div className="flex-1 flex justify-start">
          <div className="flex flex-col">
            <span className="text-[8px] xl:text-[10px] font-mono text-green-200/60 uppercase tracking-widest">Bank Status</span>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-2 h-4 rounded-sm ${i < (bankMarks / 6.7) ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'bg-white/10'}`} 
                  />
                ))}
              </div>
              <span className="font-mono text-lg xl:text-xl font-bold text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]">{bankMarks * 10}</span>
              <span className="text-[10px] xl:text-xs text-green-100/40">PTS LEFT</span>
            </div>
          </div>
        </div>

        {/* Center: Target Coin & Turn Indicator */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="flex flex-col items-center mb-1 xl:mb-2">
            <span className="text-[8px] xl:text-xs font-mono text-yellow-400/80 uppercase tracking-[0.3em] font-bold drop-shadow-sm">Target Coin</span>
            {gameState === 'playing' && playerCount === 2 && (
              <div className="flex items-center gap-1 xl:gap-2 mt-0.5 xl:mt-1">
                <div className={`w-1 h-1 xl:w-1.5 xl:h-1.5 rounded-full ${turn === 0 ? 'bg-blue-400 animate-pulse' : 'bg-white/10'}`} />
                <span className="text-[6px] xl:text-[8px] font-mono uppercase tracking-widest text-white/40">
                  {turn === 0 ? 'Your Turn' : 'AI Thinking...'}
                </span>
                <div className={`w-1 h-1 xl:w-1.5 xl:h-1.5 rounded-full ${turn === 1 ? 'bg-red-400 animate-pulse' : 'bg-white/10'}`} />
              </div>
            )}
          </div>
          <motion.div 
            key={targetCoin}
            initial={{ rotateY: 90, scale: 0.5, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            className="w-16 h-16 xl:w-36 xl:h-36 rounded-full overflow-hidden shadow-[0_0_40px_rgba(250,204,21,0.8)] border-2 xl:border-4 border-yellow-300/60 flex items-center justify-center bg-black relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/20 to-transparent pointer-events-none" />
            <img 
              src={targetCoin === 6 ? ASSETS.coin6 : ASSETS.coin7} 
              className="w-full h-full object-cover scale-[1.3] drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]"
              referrerPolicy="no-referrer"
              alt="Target Coin"
            />
            <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
          </motion.div>
        </div>

        {/* Right: Last Action & Reset */}
        <div className="flex-1 flex justify-end items-center gap-2 xl:gap-4">
          <div className="flex items-center gap-1 xl:gap-3 mr-2 xl:mr-4">
            {isAiGame && (
              <button 
                onClick={() => setIsMusicMuted(!isMusicMuted)}
                className={`flex items-center justify-center w-8 h-8 xl:w-10 xl:h-10 rounded-full transition-all border ${!isMusicMuted ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30' : 'bg-white/5 border-white/20 text-white/60 hover:bg-white/10'}`}
                title={!isMusicMuted ? "Mute Music" : "Unmute Music"}
              >
                {!isMusicMuted ? <Volume2 className="w-4 h-4 xl:w-5 xl:h-5" /> : <VolumeX className="w-4 h-4 xl:w-5 xl:h-5" />}
              </button>
            )}
            <button 
              onClick={() => setIsAutoplay(!isAutoplay)}
              className={`flex items-center justify-center w-8 h-8 xl:w-10 xl:h-10 rounded-full transition-all border ${isAutoplay ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30' : 'bg-white/5 border-white/20 text-white/60 hover:bg-white/10'}`}
              title={isAutoplay ? "Pause Autoplay" : "Start Autoplay"}
            >
              {isAutoplay ? <Pause className="w-4 h-4 xl:w-5 xl:h-5" /> : <Play className="w-4 h-4 xl:w-5 xl:h-5 ml-0.5" />}
            </button>
          </div>
          <div className="hidden xl:block text-right">
            <p className="text-xs font-mono text-green-200/60 uppercase">Last Action</p>
            <p className="text-sm italic text-yellow-400 drop-shadow-md truncate max-w-[200px]">{lastAction}</p>
          </div>
          <button 
            onClick={() => setShowExitConfirm(true)} 
            className="p-1.5 xl:p-2 hover:bg-red-500/20 rounded-full transition-colors text-white/80 hover:text-red-400"
            title="Exit Game"
          >
            <LogOut className="w-4 h-4 xl:w-5 xl:h-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showExitConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center backdrop-blur-xl p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-black/60 border border-white/20 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <Info className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-2xl font-serif italic mb-2 text-yellow-200">Leave the Forest?</h2>
              <p className="text-green-100/60 mb-8 text-sm font-mono">Your current progress will be lost forever.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all font-bold"
                >
                  Stay
                </button>
                <button 
                  onClick={() => {
                    setShowExitConfirm(false);
                    setGameState('setup');
                  }}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold transition-all"
                >
                  Exit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 relative p-2 xl:p-8 flex flex-col items-center justify-center">
        <div className={`grid gap-2 xl:gap-12 w-full max-w-7xl items-start xl:items-center ${
          playerCount === 2 ? 'grid-cols-3 xl:grid-cols-[1fr_auto_1fr]' : 
          playerCount === 3 ? 'grid-cols-3 xl:grid-cols-3' : 
          'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4'
        }`}>
          {players.map((player, idx) => (
            <React.Fragment key={player.id}>
              {/* Insert The Void in the middle for 2-player mode */}
              {idx === 1 && playerCount === 2 && (
                <div className="flex flex-col items-center gap-2 xl:gap-4 z-10">
                  <div 
                    onClick={() => {
                      if (gameState !== 'playing' || pendingAction) return;
                      if (isAiGame) {
                        handleClaim(0);
                      } else {
                        setPendingAction('claim');
                      }
                    }}
                    className={`relative w-24 h-36 xl:w-48 xl:h-72 bg-black/40 backdrop-blur-xl border-2 border-dashed rounded-2xl flex flex-col items-center justify-center shadow-2xl overflow-hidden group transition-all ${
                      players[0].voidSacrifices > 0 
                        ? 'border-white/20 cursor-pointer active:scale-95' 
                        : 'border-white/5 cursor-pointer active:scale-95'
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none" />
                    <p className={`absolute top-2 xl:top-4 left-1/2 -translate-x-1/2 text-[8px] xl:text-[10px] font-mono uppercase tracking-[0.2em] font-bold whitespace-nowrap transition-colors ${players[0].voidSacrifices > 0 ? 'text-yellow-500/80' : 'text-white/20'}`}>The Void</p>
                    
                    {voidPile.length > 0 ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {voidPile.slice(-8).map((card, i) => (
                          <motion.img 
                            key={card.id}
                            initial={{ scale: 0.8, opacity: 0, rotate: -20 }}
                            animate={{ scale: 1, opacity: 1, rotate: i * 7 - 20 }}
                            src={ASSETS.cards[card.value]} 
                            className="absolute w-16 xl:w-32 rounded-lg shadow-2xl border border-white/10"
                            style={{ zIndex: i }}
                            referrerPolicy="no-referrer"
                          />
                        ))}
                        <div className="absolute bottom-2 xl:bottom-4 left-1/2 -translate-x-1/2 bg-black/80 px-2 xl:px-3 py-0.5 xl:py-1 rounded-full text-[8px] xl:text-[10px] font-mono text-yellow-400 border border-yellow-500/30 shadow-lg">
                          {voidPile.length} CARDS
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 xl:gap-3 opacity-30 group-hover:opacity-50 transition-opacity">
                        <div className="w-10 h-10 xl:w-16 xl:h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center">
                          <div className="w-5 h-5 xl:w-8 xl:h-8 rounded-full bg-white/10 animate-pulse" />
                        </div>
                        <span className="text-[8px] xl:text-[10px] font-mono uppercase tracking-widest text-center px-2 xl:px-4">Sacrifice to the Void</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 hidden xl:flex flex-col items-center gap-1">
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20 font-mono text-xs">
                        Space
                      </kbd>
                      <span className="text-[8px] uppercase opacity-40 font-mono self-center">Claim</span>
                    </div>
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30 font-mono text-xs">
                        M
                      </kbd>
                      <span className="text-[8px] uppercase opacity-40 font-mono self-center">Setas</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center gap-2 xl:gap-6">
                <div className="text-center flex flex-col items-center">
                  <div className="flex items-center justify-center gap-1 xl:gap-2 mb-0.5 xl:mb-1">
                    {player.hearts > 0 && !(isAiGame && idx === 1) && (
                      <div className="flex gap-0.5 xl:gap-1 mb-1 xl:mb-2">
                        {Array.from({ length: player.hearts }).map((_, i) => (
                          <Heart key={i} className="w-3 h-3 xl:w-4 xl:h-4 text-red-500 fill-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-1 xl:gap-2 mb-0.5 xl:mb-1">
                    {isAiGame && idx === 1 && player.voidSacrifices > 0 && (
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                        title="Void Sacrifice Available"
                      >
                        <Ghost className="w-4 h-4 xl:w-5 xl:h-5" />
                      </motion.div>
                    )}
                    <h3 className="text-base xl:text-xl font-bold" style={{ color: player.color }}>{player.name}</h3>
                    {((!isAiGame && idx === 0) || (isAiGame && idx === 0)) && player.voidSacrifices > 0 && (
                      <motion.div
                        initial={{ scale: 0, rotate: 45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                        title="Void Sacrifice Available"
                      >
                        <Ghost className="w-4 h-4 xl:w-5 xl:h-5" />
                      </motion.div>
                    )}
                  </div>
                  <div className="font-mono text-lg xl:text-2xl font-bold leading-none">{player.score} <span className="text-[10px] xl:text-xs opacity-40">PTS</span></div>
                </div>
                <div className="relative w-24 h-36 xl:w-48 xl:h-72">
                  {isAiGame && idx === 1 && aiThinking && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1">
                      <span className="text-[10px] font-mono text-purple-400 animate-pulse uppercase">Analyzing...</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-white/5 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center">
                    {player.drawPile.length > 0 ? (
                      <motion.div 
                        className="relative w-full h-full cursor-pointer"
                        whileHover={{ scale: 1.05 }}
                        onClick={() => handleDraw(idx)}
                      >
                        <img src={ASSETS.cardBack} className="w-full h-full rounded-xl shadow-lg" referrerPolicy="no-referrer" />
                        <div className="absolute bottom-2 right-2 xl:bottom-4 xl:right-4 bg-black/80 px-2 py-1 rounded text-[10px] xl:text-xs font-mono">
                          {player.drawPile.length}
                        </div>
                      </motion.div>
                    ) : (
                      <span className="text-xs font-mono opacity-20 uppercase">Empty</span>
                    )}
                  </div>
                  <AnimatePresence mode="popLayout">
                    {player.discardPile.length > 0 && (
                      <motion.div
                        key={player.discardPile[0].id}
                        initial={{ x: -50, opacity: 0, rotate: -10 }}
                        animate={{ x: 30, opacity: 1, rotate: 5 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="absolute inset-0 z-10 cursor-pointer"
                        onClick={() => {
                          if (gameState !== 'playing' || pendingAction) return;
                          if (turn === idx && player.voidSacrifices > 0) {
                            handleSacrifice(idx);
                          }
                        }}
                      >
                        <img 
                          src={ASSETS.cards[player.discardPile[0].value]} 
                          className="w-full h-full rounded-xl shadow-2xl border border-white/10"
                          referrerPolicy="no-referrer"
                        />
                        {idx === 0 && player.voidSacrifices > 0 && (
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 xl:hidden bg-purple-500 text-white text-[8px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg">
                            Sacrifice
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="mt-2 hidden xl:flex flex-col items-center gap-1">
                  {playerCount === 2 && idx === 0 && (
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-red-500/20 text-red-400 rounded border border-red-500/30 font-mono text-xs">
                        V
                      </kbd>
                      <span className="text-[8px] uppercase opacity-40 font-mono self-center">Void</span>
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Giant Mobile/Tablet Buttons */}
        <div className="xl:hidden w-full max-w-sm flex flex-col gap-4 mt-8 px-4">
          <div className="flex gap-4 w-full">
            <button 
              onClick={() => {
                if (gameState !== 'playing' || pendingAction) return;
                if (isAiGame) {
                  handleClaim(0);
                } else {
                  setPendingAction('claim');
                }
              }}
              className={`flex-1 text-white font-black py-4 rounded-2xl active:scale-95 transition-transform text-lg uppercase tracking-tighter italic shadow-lg ${
                targetCoin === 7 
                  ? 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                  : 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]'
              }`}
            >
              CLAIM!
            </button>
            
            <button 
              onClick={() => {
                if (gameState !== 'playing' || pendingAction) return;
                if (isAiGame) {
                  handleSetas(0);
                } else {
                  setPendingAction('setas');
                }
              }}
              className="flex-1 bg-yellow-500 text-black font-black py-4 rounded-2xl active:scale-95 transition-transform shadow-[0_0_20px_rgba(234,179,8,0.4)] text-lg uppercase tracking-tighter italic"
            >
              SETAS!
            </button>
          </div>
          
          {players[0].voidSacrifices > 0 && (
            <button 
              onClick={() => {
                if (gameState !== 'playing' || pendingAction) return;
                if (isAiGame) {
                  handleSacrifice(0);
                } else {
                  setPendingAction('sacrifice');
                }
              }}
              className="w-full bg-purple-500 text-white font-black py-4 rounded-2xl active:scale-95 transition-transform shadow-[0_0_20px_rgba(168,85,247,0.4)] text-lg uppercase tracking-tighter italic flex items-center justify-center gap-2"
            >
              <Ghost className="w-5 h-5" />
              SACRIFICE
            </button>
          )}
        </div>
      </div>

      <div className="p-4 xl:p-6 bg-[#151619] border-t border-white/10 flex flex-wrap justify-center gap-4 xl:gap-12">
        <button 
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all group"
        >
          <Info className="w-4 h-4 text-yellow-400 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/80">How to Play</span>
        </button>
      </div>

      <HelpModal 
        showHelp={showHelp} 
        setShowHelp={setShowHelp} 
        currentHelpSlide={currentHelpSlide} 
        setCurrentHelpSlide={setCurrentHelpSlide} 
      />
    </div>
  );
}
