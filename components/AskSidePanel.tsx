"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  ArrowUp,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./AskSidePanel.module.css";

export interface AskSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
}

const INITIAL_DEMO_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hi! What can I help you with today? I can search, summarize, or extract action items across all your voice recordings.",
    time: "Just now",
  },
  {
    id: "2",
    role: "user",
    content: "What were the key takeaways from yesterday's product sync?",
    time: "2m ago",
  },
  {
    id: "3",
    role: "assistant",
    content: "Based on your recordings from yesterday, you discussed:\n\n• **Shipping the visualizer**: moving frequency waveform component ready for production.\n• **Refactoring hooks**: clean separation into `useAudioUpload`, `useAudioRecorder`, and `useWaveformVisualizer`.\n• **Split layout**: side-by-side Ask AI drawer that pushes main content smoothly.",
    time: "1m ago",
  },
];

export default function AskSidePanel({ isOpen, onClose }: AskSidePanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_DEMO_MESSAGES);
  const [inputPrompt, setInputPrompt] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll messages list to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Adjust textarea height on typing without showing scrollbars
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputPrompt(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputPrompt.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      time: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Demo bot response
    setTimeout(() => {
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I reviewed your recordings and found relevant details for: "${trimmed}".`,
        time: "Just now",
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 600);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <aside className={styles.panel} aria-label="Ask AI about your transcriptions">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Sparkles size={15} className={styles.headerIcon} />
          <span className={styles.title}>Ask AI</span>
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close Ask AI Panel"
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.messagesList}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.messageRow} ${
                msg.role === "user" ? styles.userRow : styles.assistantRow
              }`}
            >
              {msg.role === "user" ? (
                <div className={styles.userBubble}>{msg.content}</div>
              ) : (
                <div className={styles.assistantContainer}>
                  <div className={styles.assistantContent}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {/* Bottom AI Sparkle Icon & Action bar */}
                  <div className={styles.assistantFooter}>
                    <Sparkles className={styles.bottomIcon} size={14} />
                    <div className={styles.assistantActions}>
                      <button
                        type="button"
                        className={styles.msgActionBtn}
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        title="Copy response"
                        aria-label="Copy response"
                      >
                        {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <span className={styles.messageTime}>{msg.time}</span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputSection}>
          <form onSubmit={handleSubmit} className={styles.inputContainer}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputPrompt}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className={styles.textarea}
              placeholder="Ask a question about your transcriptions..."
            />

            <div className={styles.inputToolbar}>
              <div className={styles.toolbarRight}>
                <button
                  type="submit"
                  className={`${styles.submitBtn} ${
                    inputPrompt.trim() ? styles.submitBtnActive : ""
                  }`}
                  disabled={!inputPrompt.trim()}
                  aria-label="Send message"
                  title="Send (Enter)"
                >
                  <ArrowUp size={15} />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </aside>
  );
}
