import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import {
  HelpCircle,
  X,
  Send,
  Sparkles,
  Bot,
  User,
  Volume2,
  Square,
  BookOpen,
  Compass,
  Mic,
  Bookmark,
  Cloud,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";
import { loadAISettings } from "../utils/aiConfig";

interface HelpMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: string;
}

interface HelpChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpChatbotModal: React.FC<HelpChatbotModalProps> = ({ isOpen, onClose }) => {
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState<HelpMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Hello! I am your LocalExplorer AI Assistant. I can help you learn how to use all the features of this app, from generating custom trip itineraries and asking local guides to setting up voice companions and offline pocket guides. How can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Drag and Resize State
  const [size, setSize] = useState({ width: 420, height: 540 });
  const dragControls = useDragControls();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  const handleToggleSpeech = (msgId: string, text: string) => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in your browser.");
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.02;

      utterance.onend = () => setSpeakingMsgId(null);
      utterance.onerror = () => setSpeakingMsgId(null);

      window.speechSynthesis.speak(utterance);
      setSpeakingMsgId(msgId);
    }
  };

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const sendMessageText = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: HelpMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Calculate next messages list immediately for the backend payload
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsTyping(true);

    const payloadMessages = updatedMessages.map((m) => ({
      role: m.sender === "user" ? ("user" as const) : ("model" as const),
      text: m.text,
    }));

    try {
      const res = await fetch("/api/help-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: payloadMessages,
          aiSettings: loadAISettings(),
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to fetch response");
      }
      const data = await res.json();
      const botMsg: HelpMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Help chatbot error:", err);
      const errorMsg: HelpMessage = {
        id: `bot-err-${Date.now()}`,
        sender: "bot",
        text: "Sorry, I encountered an issue connecting to the help assistant service. Please check your connection or try again shortly.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const text = inputValue;
    setInputValue("");
    sendMessageText(text);
  };

  const handleQuickPrompt = (promptText: string) => {
    sendMessageText(promptText);
  };

  // Top-Left corner resize logic (expands top-left from bottom-right origin)
  const handleResizeTopLeftStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isTouch = "touches" in e;
    const startX = isTouch ? e.touches[0].clientX : e.clientX;
    const startY = isTouch ? e.touches[0].clientY : e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      const isMoveTouch = "touches" in moveEvent;
      const currentX = isMoveTouch ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = isMoveTouch ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const newWidth = Math.max(340, Math.min(800, startWidth - (currentX - startX)));
      const newHeight = Math.max(400, Math.min(900, startHeight - (currentY - startY)));
      setSize({ width: newWidth, height: newHeight });
    };

    const handlePointerUp = () => {
      document.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchmove", handlePointerMove);
      document.removeEventListener("touchend", handlePointerUp);
    };

    document.addEventListener("mousemove", handlePointerMove);
    document.addEventListener("mouseup", handlePointerUp);
    document.addEventListener("touchmove", handlePointerMove, { passive: false });
    document.addEventListener("touchend", handlePointerUp);
  };

  // Bottom-Left corner resize logic (expands bottom-left)
  const handleResizeBottomLeftStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isTouch = "touches" in e;
    const startX = isTouch ? e.touches[0].clientX : e.clientX;
    const startY = isTouch ? e.touches[0].clientY : e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      const isMoveTouch = "touches" in moveEvent;
      const currentX = isMoveTouch ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = isMoveTouch ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const newWidth = Math.max(340, Math.min(800, startWidth - (currentX - startX)));
      const newHeight = Math.max(400, Math.min(900, startHeight + (currentY - startY)));
      setSize({ width: newWidth, height: newHeight });
    };

    const handlePointerUp = () => {
      document.removeEventListener("mousemove", handlePointerMove);
      document.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("touchmove", handlePointerMove);
      document.removeEventListener("touchend", handlePointerUp);
    };

    document.addEventListener("mousemove", handlePointerMove);
    document.addEventListener("mouseup", handlePointerUp);
    document.addEventListener("touchmove", handlePointerMove, { passive: false });
    document.addEventListener("touchend", handlePointerUp);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      initial={{ opacity: 0, scale: 0.8, y: 40 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 40 }}
      transition={{ type: "spring", damping: 25, stiffness: 280 }}
      style={{ width: `${size.width}px`, height: `${size.height}px` }}
      className="fixed bottom-24 right-4 sm:right-6 md:right-8 z-50 bg-white rounded-3xl shadow-2xl border border-stone-200/95 overflow-hidden flex flex-col max-h-[90vh] max-w-[95vw] pointer-events-auto no-print"
    >
      {/* Top-Left Corner Resize Handle */}
      <div
        onMouseDown={handleResizeTopLeftStart}
        onTouchStart={handleResizeTopLeftStart}
        className="absolute top-1.5 left-1.5 w-5 h-5 cursor-nwse-resize flex items-center justify-center group z-50 select-none"
        title="Drag to resize (Top-Left)"
      >
        <svg className="w-3.5 h-3.5 text-stone-300/40 group-hover:text-stone-300 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="4" y1="4" x2="16" y2="16" />
          <line x1="4" y1="10" x2="10" y2="4" />
        </svg>
      </div>

      {/* Bottom-Left Corner Resize Handle */}
      <div
        onMouseDown={handleResizeBottomLeftStart}
        onTouchStart={handleResizeBottomLeftStart}
        className="absolute bottom-1.5 left-1.5 w-5 h-5 cursor-nesw-resize flex items-center justify-center group z-50 select-none"
        title="Drag to resize (Bottom-Left)"
      >
        <svg className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#5A5A40] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="4" y1="20" x2="16" y2="8" />
          <line x1="4" y1="14" x2="10" y2="20" />
        </svg>
      </div>

      {/* Header (Drag Handle) */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="cursor-move select-none bg-[#5A5A40] text-white p-4 sm:p-5 flex items-center justify-between shadow-xs shrink-0 pl-7"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white shadow-inner">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-lg text-stone-100">
              <TranslatedText text="LocalExplorer Help & Guide" />
            </h3>
            <p className="text-xs text-stone-300 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <TranslatedText text="Ask anything about how the app works" />
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Suggestion Chips */}
      <div className="bg-stone-50 border-b border-stone-200 px-4 py-2.5 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
        {[
          "How to generate an itinerary?",
          "How does the voice audio guide work?",
          "Can I use the app offline?",
          "How to use Travel Wallet?",
        ].map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickPrompt(chip)}
            className="px-3 py-1 bg-white hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 text-xs rounded-full border border-stone-200 shadow-xs whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>{chip}</span>
            <ChevronRight className="w-3 h-3 text-stone-400" />
          </button>
        ))}
      </div>

      {/* Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-100/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
                msg.sender === "user" ? "bg-stone-800 text-white" : "bg-[#5A5A40] text-white"
              }`}
            >
              {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[80%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                msg.sender === "user"
                  ? "bg-stone-800 text-white rounded-tr-xs"
                  : "bg-white text-stone-800 border border-stone-200/90 rounded-tl-xs"
              }`}
            >
              <div className="font-sans whitespace-pre-wrap">
                <TranslatedText text={msg.text} />
              </div>

              <div className="mt-2 pt-2 border-t border-stone-200/40 flex items-center justify-between text-[10px] text-stone-400">
                <span>{msg.timestamp}</span>
                {msg.sender === "bot" && (
                  <button
                    onClick={() => handleToggleSpeech(msg.id, msg.text)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                      speakingMsgId === msg.id
                        ? "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                        : "bg-stone-100 hover:bg-stone-200 text-stone-600"
                    }`}
                  >
                    {speakingMsgId === msg.id ? (
                      <>
                        <Square className="w-3 h-3 text-amber-700 fill-amber-700" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3 h-3" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center gap-2 text-stone-500 text-xs italic p-2">
            <div className="w-6 h-6 rounded-full bg-[#5A5A40] text-white flex items-center justify-center">
              <Bot className="w-3 h-3" />
            </div>
            <span>Assistant is typing...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Footer */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-stone-200 flex items-center gap-2 shrink-0 pl-6 pr-4">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask anything about how the app works..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#5A5A40]/30 bg-stone-50"
        />
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="px-4 py-2.5 rounded-xl bg-[#5A5A40] hover:bg-[#4a4a34] disabled:opacity-50 text-white font-medium text-xs sm:text-sm transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </motion.div>
  );
};
