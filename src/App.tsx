import React, { useState, useEffect, useRef } from 'react';

import { Volume2, Plus, X, Trash2, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PictureCard, CategoryMap, INITIAL_CARDS } from './data';

export default function App() {
  const [cards, setCards] = useState<CategoryMap>(() => {
    const saved = localStorage.getItem("picture_cards");
    return saved ? JSON.parse(saved) : INITIAL_CARDS;
  });
  
  const [recentCards, setRecentCards] = useState<PictureCard[]>(() => {
    const saved = localStorage.getItem("recent_picture_cards");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("picture_cards", JSON.stringify(cards));
  }, [cards]);

  useEffect(() => {
    localStorage.setItem("recent_picture_cards", JSON.stringify(recentCards));
  }, [recentCards]);

  const [currentCategory, setCurrentCategory] = useState<string>("最近使った");
  const [currentlySpeaking, setCurrentlySpeaking] = useState<string | null>(null);
  
  // Add Card State
  const [isAdding, setIsAdding] = useState(false);
  const [newCardText, setNewCardText] = useState("");
  const [newCardPronunciation, setNewCardPronunciation] = useState("");
  const [newCardIcon, setNewCardIcon] = useState("💬");
  const currentUtteranceId = useRef<number>(0);

  // Add Category State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [showMicGuide, setShowMicGuide] = useState(false);
  const [showMicBanner, setShowMicBanner] = useState(() => {
    return localStorage.getItem('micBannerDismissed') !== 'true';
  });
  const recognitionRef = useRef<any>(null);

  // DateTime Modal State
  const [isDateTimeModalOpen, setIsDateTimeModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [directInputText, setDirectInputText] = useState("");
  const directInputTextRef = useRef(directInputText);
  const hasRecognizedTextRef = useRef(false);

  useEffect(() => {
    directInputTextRef.current = directInputText;
  }, [directInputText]);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: "", onConfirm: () => {} });

  const speak = (text: string, card?: PictureCard) => {
    if (!('speechSynthesis' in window)) {
      alert("お使いのブラウザは音声読み上げに対応していません。");
      return;
    }

    if (!card) {
      // If spoken from direct input, create a temporary card representation
      card = { id: `history-${Date.now()}`, icon: "💬", text };
    }

    setRecentCards(prev => {
      // Filter out duplicates (by exact text to catch both manual and card inputs of same message)
      const filtered = prev.filter(c => c.text !== text);
      return [card!, ...filtered].slice(0, 12);
    });

    // Cancel any ongoing speech before starting a new one
    window.speechSynthesis.cancel();
    
    const utteranceId = ++currentUtteranceId.current;

    const utterance = new SpeechSynthesisUtterance(card?.pronunciation || text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    
    utterance.onstart = () => {
      setCurrentlySpeaking(text);
    };
    
    utterance.onend = () => {
      if (currentUtteranceId.current === utteranceId) {
        setCurrentlySpeaking(null);
      }
    };
    
    utterance.onerror = () => {
      if (currentUtteranceId.current === utteranceId) {
        setCurrentlySpeaking(null);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const speakRef = useRef(speak);
  useEffect(() => {
    speakRef.current = speak;
  });

  // Request mic permission and start listening *immediately* (no async/await) to keep the iOS user‑chain.
  const requestMicAccess = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      // Initiate permission request without awaiting; keep within same user gesture.
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          // Stop tracks – we only needed the permission.
          stream.getTracks().forEach((track) => track.stop());
        })
        .catch((err) => {
          console.warn('getUserMedia mic request error:', err);
        });
    }
    // Mark permission attempt and start listening immediately.
    // Permission will be handled by SpeechRecognition start().
    setShowMicGuide(false);
    startListening();
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("お使いのブラウザは音声認識に対応していません。");
      return;
    }

    // Always create a fresh instance – iOS Safari silently fails if an old one is reused
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) { /* ignore */ }
      recognitionRef.current = null;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = !isIOS; // iOS does not support continuous mode
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'ja-JP';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setShowMicGuide(false);
      hasRecognizedTextRef.current = false;
      localStorage.setItem('micPermissionGranted', 'true');
    };

    recognitionRef.current.onresult = (event: any) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
      }
      if (final) {
        setDirectInputText(prev => prev + final);
        hasRecognizedTextRef.current = true;
      }
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      if (hasRecognizedTextRef.current && directInputTextRef.current) {
        speakRef.current(directInputTextRef.current);
      }
      hasRecognizedTextRef.current = false;
      // Clear so next tap creates a fresh instance
      recognitionRef.current = null;
    };

    recognitionRef.current.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error);
      if (event.error === 'not-allowed') setShowMicGuide(false);
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('SpeechRecognition start failed:', error);
    }
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
        return;
    }

    // Request mic permission (non‑awaited) then start listening immediately.
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
            console.warn('getUserMedia error:', err);
        });
    }
    startListening();
};

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardText.trim()) return;

    const newCard: PictureCard = {
      id: `card-${Date.now()}`,
      icon: newCardIcon || "💬",
      text: newCardText,
      pronunciation: newCardPronunciation || undefined
    };

    setCards(prev => ({
      ...prev,
      [currentCategory]: [...(prev[currentCategory] || []), newCard]
    }));

    setNewCardText("");
    setNewCardPronunciation("");
    setNewCardIcon("💬");
    setIsAdding(false);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    
    if (cards[name] || name === "最近使った") {
      alert("すでに存在するジャンル名です。");
      return;
    }

    setCards(prev => ({
      ...prev,
      [name]: []
    }));
    
    setCurrentCategory(name);
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  const handleDeleteCategory = (category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      message: `ジャンル「${category}」とその中のカードをすべて削除しますか？`,
      onConfirm: () => {
        setCards(prev => {
          const newCards = { ...prev };
          delete newCards[category];
          return newCards;
        });
        setCurrentCategory("最近使った");
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteCard = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentCategory === "最近使った") {
      setRecentCards(prev => prev.filter(c => c.id !== cardId));
      return;
    }
    setConfirmDialog({
      isOpen: true,
      message: "このカードを削除してもよろしいですか？",
      onConfirm: () => {
        setCards(prev => ({
          ...prev,
          [currentCategory]: prev[currentCategory].filter(c => c.id !== cardId)
        }));
        setRecentCards(prev => prev.filter(c => c.id !== cardId));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDateTimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let textToSpeak = "";
    if (selectedDate) {
      const d = new Date(selectedDate);
      textToSpeak += `${d.getMonth() + 1}月${d.getDate()}日 `;
    }
    if (selectedTime) {
      textToSpeak += `${selectedTime} `;
    }
    
    if (textToSpeak) {
      speak(textToSpeak.trim(), { id: `time-${Date.now()}`, icon: "🗓️", text: textToSpeak.trim() });
      setIsDateTimeModalOpen(false);
      setSelectedDate("");
      setSelectedTime("");
    }
  };

  const getRenderCards = () => {
    if (currentCategory === "最近使った") {
      return recentCards;
    }
    const currentCards = cards[currentCategory] || [];
    if (currentCategory === "作業質問" || currentCategory === "作業・質問" || currentCategory === "予定") {
      return [
        { id: "special-datetime", icon: "🗓️", text: "日時を指定して伝える" },
        ...currentCards
      ];
    }
    return currentCards;
  };

  const renderCardsList = getRenderCards();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-200 pb-32">
      
      {/* Sticky Top Section */}
      <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200/50 shadow-[0_10px_20px_-15px_rgba(0,0,0,0.05)] pt-4 md:pt-6 pb-4">
        <div className="max-w-4xl mx-auto px-4 md:px-8 flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              絵カードコミュニケーション
            </h1>
            <p className="text-sm md:text-base text-slate-500 font-medium pb-1 hidden md:block">
              カードをタップするか、直接入力して音声で読み上げます
            </p>
          </div>

          <div className="flex justify-center -mx-4 md:mx-0">
            <div className="w-full md:w-auto px-4 md:px-0">
              <AnimatePresence mode="wait">
                {currentlySpeaking ? (
                  <motion.div 
                    key="speaking"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="flex items-center justify-center gap-4 text-xl md:text-2xl font-bold bg-white text-slate-800 py-3 md:py-4 px-6 md:px-8 rounded-full shadow-lg border-2 border-blue-100 min-h-[60px] md:min-h-[72px]"
                  >
                    <Volume2 className="w-8 h-8 md:w-10 md:h-10 animate-pulse text-blue-500 shrink-0" />
                    <span className="leading-snug">{currentlySpeaking}</span>
                  </motion.div>
                ) : (
                  <motion.form 
                    key="input-form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (directInputText.trim()) {
                        speak(directInputText.trim());
                        setDirectInputText("");
                      }
                    }}
                    className="w-full max-w-2xl flex items-end gap-2 md:gap-3 bg-slate-50 rounded-2xl p-1 md:p-2 border-2 border-slate-100 focus-within:border-blue-300 focus-within:bg-white transition-all"
                  >
                    <textarea 
                      value={directInputText}
                      onChange={(e) => setDirectInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (directInputText.trim()) {
                            speak(directInputText.trim());
                            setDirectInputText("");
                          }
                        }
                      }}
                      placeholder="声に出して伝えたいカードを選ぶか、ここに入力..."
                      rows={1}
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                        }
                      }}
                      className="flex-1 bg-transparent border-none outline-none text-base md:text-xl px-3 md:px-4 py-2 text-slate-800 placeholder:text-slate-400 resize-none overflow-y-auto"
                      style={{ minHeight: '44px' }}
                    />
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={toggleListening}
                        className={`p-2 md:p-3 mb-0.5 md:mb-0 rounded-xl transition-colors shrink-0 flex items-center justify-center ${
                          isListening ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                        title={isListening ? "音声認識を停止" : "マイクで入力"}
                      >
                        {isListening ? <MicOff className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
                      </button>
                      <button 
                        type="submit"
                        disabled={!directInputText.trim()}
                        className="bg-blue-600 text-white p-2 md:p-3 mb-0.5 md:mb-0 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center justify-center"
                        title="入力したテキストを読み上げる (Enter)"
                      >
                        <Volume2 className="w-5 h-5 md:w-6 md:h-6" />
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center -mx-4 px-4 md:mx-0 md:px-0">
            {/* Fixed Left Tab */}
            <div className="flex shrink-0 items-center pr-3 border-r-2 border-slate-200 mr-3 relative z-10">
              <button
                onClick={() => setCurrentCategory("最近使った")}
                className={`px-5 py-2.5 rounded-full whitespace-nowrap font-bold text-sm md:text-base transition-all active:scale-95 border-2 ${
                  currentCategory === "最近使った"
                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                最近使った
              </button>
            </div>
            
            {/* Scrollable Tabs */}
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide flex-1 items-center">
              {Object.keys(cards).map((category) => (
              <div key={category} className="flex shrink-0 items-center">
                <button
                  onClick={() => setCurrentCategory(category)}
                  className={`px-6 py-3 rounded-l-full whitespace-nowrap font-bold text-sm md:text-base transition-all active:scale-95 ${
                    currentCategory === category 
                      ? 'bg-slate-800 text-white shadow-md' 
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {category}
                </button>
                <button
                  onClick={(e) => handleDeleteCategory(category, e)}
                  className={`px-3 py-3 rounded-r-full flex items-center justify-center transition-colors ${
                    currentCategory === category
                      ? 'bg-slate-700 text-slate-300 hover:bg-red-500 hover:text-white'
                      : 'bg-slate-200 text-slate-400 hover:bg-red-500 hover:text-white'
                  }`}
                  title="ジャンルを削除"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {isAddingCategory ? (
              <form onSubmit={handleAddCategory} className="flex gap-2 shrink-0">
                <input
                  type="text"
                  autoFocus
                  placeholder="新しいジャンル名"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="px-4 py-2 rounded-full border border-slate-300 outline-none focus:border-blue-500 text-sm md:text-base w-32 md:w-48"
                />
                <button type="submit" disabled={!newCategoryName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-full font-bold text-sm md:text-base disabled:opacity-50">
                  追加
                </button>
                <button type="button" onClick={() => setIsAddingCategory(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsAddingCategory(true)}
                className="px-4 py-3 rounded-full whitespace-nowrap font-bold text-sm md:text-base transition-all active:scale-95 shrink-0 bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 border-dashed flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                ジャンルを追加
              </button>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 mt-6">
        
        {/* Card Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          <AnimatePresence mode="popLayout">
              {renderCardsList.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-12 text-center text-slate-400 font-medium"
                >
                  まだカードがありません。下から追加してください。
                </motion.div>
              ) : (
                renderCardsList.map((card) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={card.id}
                  >
                    <button
                      onClick={() => {
                        if (card.id === "special-datetime") {
                          setIsDateTimeModalOpen(true);
                        } else {
                          speak(card.text, card);
                        }
                      }}
                      className="w-full relative group bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-1 transition-all active:scale-95 flex flex-col items-center justify-center gap-3 aspect-square"
                    >
                      <div className="text-5xl md:text-6xl mb-2 group-hover:scale-110 transition-transform">{card.icon}</div>
                      <div className="font-bold text-base md:text-lg text-slate-700 leading-tight">
                        {card.text}
                      </div>
                      
                      {card.id !== "special-datetime" && (
                        <button
                          onClick={(e) => handleDeleteCard(card.id, e)}
                          className="absolute top-2 right-2 p-2.5 bg-slate-100 text-slate-400 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all focus:opacity-100"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </button>
                  </motion.div>
                ))
              )}
          </AnimatePresence>
        </div>

        {/* Add New Card Section */}
        {currentCategory !== "最近使った" && (
          <div className="mt-4 pt-8 border-t border-slate-200 pb-16">
            <AnimatePresence mode="wait">
              {isAdding ? (
                <motion.form 
                  key="form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleAddCard} 
                  className="flex flex-col md:flex-row gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
                >
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="w-16 h-16 md:w-20 md:h-auto bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-center justify-center focus-within:border-blue-500 focus-within:bg-white transition-colors shrink-0 shadow-inner">
                        <input 
                          type="text" 
                          value={newCardIcon}
                          onChange={(e) => setNewCardIcon(e.target.value)}
                          className="w-full text-center py-2 md:py-4 bg-transparent outline-none text-2xl md:text-3xl"
                          title="絵文字を入力してください"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 focus-within:border-blue-500 focus-within:bg-white transition-colors">
                        <input 
                          type="text" 
                          autoFocus
                          placeholder="例：お茶を飲みたいです"
                          value={newCardText}
                          onChange={(e) => setNewCardText(e.target.value)}
                          className="w-full py-4 bg-transparent outline-none text-slate-800 text-lg placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                    <div className="flex-1 flex items-center bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 focus-within:border-blue-500 focus-within:bg-white transition-colors">
                      <input 
                        type="text" 
                        placeholder="読み（任意） 例：おちゃをのみたいです"
                        value={newCardPronunciation}
                        onChange={(e) => setNewCardPronunciation(e.target.value)}
                        className="w-full py-3 bg-transparent outline-none text-slate-800 text-sm md:text-base placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="submit" 
                      disabled={!newCardText.trim()}
                      className="flex-1 md:flex-none px-6 py-4 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      追加
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setIsAdding(false)}
                      className="px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.button 
                  key="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsAdding(true)}
                  className="w-full py-6 md:py-8 border-2 border-dashed border-slate-300 rounded-3xl text-slate-500 font-bold text-lg hover:border-slate-400 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-6 h-6" />
                  新しいカードを追加
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Initialize / Reset Data */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 mt-12 flex justify-center pb-8">
        <button 
          onClick={() => {
            if(window.confirm('すべての設定を初期状態に戻します。よろしいですか？')) {
              localStorage.removeItem("picture_cards");
              localStorage.removeItem("recent_picture_cards");
              window.location.reload();
            }
          }}
          className="text-sm font-bold text-slate-400 flex items-center gap-2 hover:text-slate-600 bg-white px-6 py-3 rounded-full border border-slate-200 shadow-sm transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          初期状態にリセット
        </button>
      </div>

      {/* DateTime Input Modal */}
      <AnimatePresence>
        {isDateTimeModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsDateTimeModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-sm shadow-2xl"
            >
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <span className="text-2xl">🗓️</span>
                日時を指定する
              </h2>
              <form onSubmit={handleDateTimeSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-600">日付</label>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-600">時刻</label>
                  <input 
                    type="time" 
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg"
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsDateTimeModalOpen(false)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedDate && !selectedTime}
                    className="flex-1 py-3 px-4 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    決定
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Microphone Permission Banner */}
      <AnimatePresence>
        {showMicBanner && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-blue-600 text-white p-4 md:p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border-b-4 border-blue-800"
          >
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="bg-white text-blue-600 p-3 rounded-full hidden md:block"><Mic className="w-8 h-8" /></div>
              <div>
                <p className="font-bold text-xl md:text-2xl mb-2 flex items-center gap-2"><span className="md:hidden"><Mic className="w-6 h-6" /></span>マイクの使用を許可してください</p>
                <p className="text-base md:text-lg text-blue-50 leading-relaxed font-medium">マイクボタンを押し、表示されるブラウザの許可画面で「許可」を選んでください。</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowMicBanner(false);
                localStorage.setItem('micBannerDismissed', 'true');
              }}
              className="p-3 md:p-4 bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors shrink-0 w-full sm:w-auto flex justify-center items-center gap-2"
              aria-label="マイク案内を閉じる"
            >
              <span className="sm:hidden font-bold">閉じる</span><X className="w-6 h-6 hidden sm:block" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Microphone Permission Guide */}
      <AnimatePresence>
        {showMicGuide && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="bg-white rounded-3xl p-8 max-w-2xl w-full text-center shadow-2xl flex flex-col items-center">
              <div className="bg-blue-100 text-blue-600 p-6 rounded-full mb-6"><Mic className="w-16 h-16" /></div>
              <h2 className="text-3xl font-bold text-slate-800 mb-6">マイクの使用許可</h2>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">このあと表示されるブラウザの確認画面で、マイクの使用を許可してください。</p>
              <div className="flex gap-4 w-full">
                <button onClick={() => setShowMicGuide(false)} className="flex-1 py-4 text-lg font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">キャンセル</button>
                <button onClick={requestMicAccess} className="flex-1 py-4 text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-200">確認して進む</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog Modal */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">確認</h3>
              <p className="text-slate-600 mb-8">{confirmDialog.message}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 px-4 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="flex-1 py-3 px-4 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  削除する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
