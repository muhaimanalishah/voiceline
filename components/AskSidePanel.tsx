"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  X,
  ArrowUp,
  Sparkles,
  Copy,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./AskSidePanel.module.css";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isTextUIPart, UIMessage } from "ai";

export interface AskSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MatchedNoteMetadata {
  id: string;
  title: string | null;
  tagName: string | null;
  createdAt: string;
  chunkContent: string;
  chunkIndex: number;
  matchType?: "hybrid" | "vector" | "keyword";
  score?: number;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

function getMessageSources(message: UIMessage): MatchedNoteMetadata[] {
  const meta = message.metadata as
    | { matchedNotes?: MatchedNoteMetadata[] }
    | undefined;
  return meta?.matchedNotes || [];
}

export default function AskSidePanel({ isOpen, onClose }: AskSidePanelProps) {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const [inputPrompt, setInputPrompt] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collapsedSources, setCollapsedSources] = useState<Record<string, boolean>>({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll messages list to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

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

  const handleSubmit = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
    }
    const trimmed = inputPrompt.trim();
    if (!trimmed || isLoading) return;

    sendMessage({ text: trimmed });
    setInputPrompt("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSources = (msgId: string) => {
    setCollapsedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  if (!isOpen) return null;

  const lastMessage = messages[messages.length - 1];
  const isGeneratingBeforeStreaming =
    isLoading && (!lastMessage || lastMessage.role === "user" || getMessageText(lastMessage).length === 0);

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
          {messages.map((msg) => {
            const text = getMessageText(msg);
            const sources = getMessageSources(msg);
            const isCollapsed = collapsedSources[msg.id] ?? false;

            return (
              <div
                key={msg.id}
                className={`${styles.messageRow} ${
                  msg.role === "user" ? styles.userRow : styles.assistantRow
                }`}
              >
                {msg.role === "user" ? (
                  <div className={styles.userBubble}>{text}</div>
                ) : (
                  <div className={styles.assistantContainer}>
                    <div className={styles.assistantContent}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {text}
                      </ReactMarkdown>
                    </div>

                    {/* Referenced Sources Section */}
                    {sources.length > 0 && (
                      <div className={styles.sourcesSection}>
                        <button
                          type="button"
                          className={styles.sourcesHeader}
                          onClick={() => toggleSources(msg.id)}
                          aria-label="Toggle referenced sources"
                        >
                          <div className={styles.sourcesHeaderLeft}>
                            <FileText size={13} />
                            <span>Referenced Notes</span>
                            <span className={styles.sourcesCountBadge}>
                              {sources.length}
                            </span>
                          </div>
                          {isCollapsed ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronUp size={14} />
                          )}
                        </button>

                        {!isCollapsed && (
                          <div className={styles.sourcesList}>
                            {sources.map((source, idx) => (
                              <Link
                                key={`${source.id}-${source.chunkIndex}-${idx}`}
                                href={`/notes/${source.id}`}
                                className={styles.sourceCard}
                                title={`Open "${source.title || "Voice Note"}"`}
                              >
                                <div className={styles.sourceCardTop}>
                                  <div className={styles.sourceTitleRow}>
                                    <span className={styles.sourceTitle}>
                                      {source.title || "Untitled Note"}
                                    </span>
                                    {source.chunkIndex > 0 && (
                                      <span className={styles.matchBadge}>
                                        Sec {source.chunkIndex + 1}
                                      </span>
                                    )}
                                  </div>
                                  <div className={styles.sourceBadges}>
                                    {source.tagName && (
                                      <span className={styles.tagBadge}>
                                        {source.tagName}
                                      </span>
                                    )}
                                    {source.matchType && (
                                      <span className={styles.matchBadge}>
                                        {source.matchType}
                                      </span>
                                    )}
                                    <ExternalLink size={11} />
                                  </div>
                                </div>
                                {source.chunkContent && (
                                  <p className={styles.sourceExcerpt}>
                                    {source.chunkContent}
                                  </p>
                                )}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom AI Sparkle Icon & Action bar */}
                    <div className={styles.assistantFooter}>
                      <Sparkles className={styles.bottomIcon} size={14} />
                      <div className={styles.assistantActions}>
                        <button
                          type="button"
                          className={styles.msgActionBtn}
                          onClick={() => handleCopyMessage(msg.id, text)}
                          title="Copy response"
                          aria-label="Copy response"
                        >
                          {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading & Generation State before streaming begins */}
          {isGeneratingBeforeStreaming && (
            <div className={`${styles.messageRow} ${styles.assistantRow}`}>
              <div className={styles.loadingContainer}>
                <div className={styles.loadingHeader}>
                  <Sparkles size={14} className={styles.loadingSparkle} />
                  <span className={styles.loadingText}>
                    Searching notes with hybrid retrieval & generating...
                  </span>
                </div>
                <div className={styles.shimmerBars}>
                  <div className={styles.shimmerBar} />
                  <div className={`${styles.shimmerBar} ${styles.shimmerBarShort}`} />
                </div>
              </div>
            </div>
          )}

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
                  disabled={!inputPrompt.trim() || isLoading}
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

