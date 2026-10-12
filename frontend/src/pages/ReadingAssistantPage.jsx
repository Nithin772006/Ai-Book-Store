import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getBookById, askReadingAssistant } from '../api/books';

gsap.registerPlugin(useGSAP);

const STARTER_PROMPTS = [
  'Recommend a gripping gothic mystery with rich philosophical atmosphere.',
  'What should I read if I love historical fiction set in medieval monasteries?',
  'Explain the narrative concept of the unreliable narrator with examples.',
  'Suggest three thoughtful discussion questions for a literary salon reading group.',
];

export default function ReadingAssistantPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialBookId = searchParams.get('bookId');

  const [selectedBook, setSelectedBook] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const [prevBookId, setPrevBookId] = useState(initialBookId);
  if (initialBookId !== prevBookId) {
    setPrevBookId(initialBookId);
    if (!initialBookId) {
      setSelectedBook(null);
    }
  }

  // Load contextual book if bookId is present in URL query
  useEffect(() => {
    if (!initialBookId) return;

    let isMounted = true;
    getBookById(initialBookId)
      .then((data) => {
        if (isMounted) setSelectedBook(data);
      })
      .catch((err) => {
        console.warn('Could not load contextual book for reading assistant:', err);
      });

    return () => { isMounted = false; };
  }, [initialBookId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.assistant-anim-fade', {
      opacity: 0,
      y: 16,
      stagger: 0.08,
      duration: 0.6,
      ease: 'power3.out',
    });
  }, { scope: chatContainerRef, dependencies: [] });

  const handleClearContext = () => {
    setSelectedBook(null);
    setSearchParams({});
  };

  const handleSendMessage = async (textToSend = null) => {
    let content = (typeof textToSend === 'string' ? textToSend : inputMessage).trim();
    if (!content) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'user') {
        content = lastMsg.content;
      }
    }
    if (!content || loading) return;

    if (content.length > 1000) {
      setError('Please limit your message to 1,000 characters.');
      return;
    }

    const lastMsg = messages[messages.length - 1];
    let updatedMessages = messages;
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== content) {
      const userMsg = { role: 'user', content };
      updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
    }
    setInputMessage('');
    setError(null);
    setLoading(true);

    // Build bounded history (up to 6 previous messages before the active prompt)
    const historyPayload = updatedMessages.slice(0, -1).slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const data = await askReadingAssistant({
        message: content,
        bookId: selectedBook?.id || null,
        history: historyPayload,
      });

      const assistantMsg = {
        role: 'assistant',
        content: data.reply,
        recommendedBooks: data.recommended_books || [],
        model: data.model,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Reading Assistant request failed:', err);
      const serverMsg = err.response?.data?.error;
      setError(
        serverMsg || 'Unable to consult the Reading Assistant. Please check the network connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartNewConversation = () => {
    setMessages([]);
    setError(null);
    setInputMessage('');
    if (textareaRef.current) textareaRef.current.focus();
  };

  return (
    <div ref={chatContainerRef} className="reading-assistant-page store-container">
      {/* Breadcrumbs */}
      <nav className="editorial-breadcrumbs" aria-label="Breadcrumb Trail">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active" aria-current="page">AI Reading Assistant</span>
      </nav>

      {/* Header Banner */}
      <div className="assistant-header-banner assistant-anim-fade">
        <div className="assistant-header-content">
          <div className="assistant-crest-cluster">
            <span className="assistant-crest-sparkle">✦</span>
            <span className="assistant-kicker">AETHERIUM INTELLIGENCE</span>
          </div>
          <h1 className="assistant-headline">Literary Reading Assistant</h1>
          <p className="assistant-subtitle">
            An articulate advisor grounded strictly in the AETHERIUM catalogue.
            Inquire about specific volumes, discover curated titles, and explore literary themes.
          </p>
        </div>

        {/* New Conversation Button */}
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleStartNewConversation}
            className="btn-new-chat"
            id="btn-new-conversation"
            aria-label="Begin a new reading conversation"
          >
            <span>Begin New Conversation</span>
          </button>
        )}
      </div>

      {/* Contextual Book Banner if focused on a specific volume */}
      {selectedBook && (
        <div className="assistant-context-pill-banner assistant-anim-fade" role="status">
          <div className="context-pill-content">
            <span className="context-pill-icon">📖</span>
            <span className="context-pill-label">Focused on volume:</span>
            <strong className="context-pill-title">{selectedBook.title}</strong>
            <span className="context-pill-author">by {selectedBook.author}</span>
          </div>
          <button
            type="button"
            onClick={handleClearContext}
            className="context-pill-clear-btn"
            id="btn-clear-book-context"
            title="Clear book focus to discuss the broader catalogue"
          >
            ✕ Clear Focus
          </button>
        </div>
      )}

      {/* Chat Display Pane */}
      <div className="assistant-chat-pane assistant-anim-fade">
        {/* Empty State / Starter Prompts */}
        {messages.length === 0 && (
          <div className="assistant-empty-state">
            <div className="empty-state-crest">✦</div>
            <h2 className="empty-state-title">How may the archives assist your reading today?</h2>
            <p className="empty-state-hint">
              Select an inquiry below or write your own question to begin exploring.
            </p>

            <div className="starter-prompts-grid">
              {STARTER_PROMPTS.map((promptText, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(promptText)}
                  className="starter-prompt-card"
                  id={`btn-starter-prompt-${idx}`}
                >
                  <span className="starter-prompt-quote">“</span>
                  <span className="starter-prompt-text">{promptText}</span>
                  <span className="starter-prompt-arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Thread */}
        {messages.length > 0 && (
          <div className="chat-messages-thread" role="log" aria-live="polite">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-bubble-row ${msg.role === 'user' ? 'row-user' : 'row-assistant'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="assistant-avatar" aria-hidden="true">✦</div>
                )}

                <div className={`chat-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-assistant'}`}>
                  {msg.role === 'assistant' && (
                    <div className="bubble-assistant-header">
                      <span className="assistant-brand-tag">AETHERIUM Literary Intelligence</span>
                      <span className="assistant-groq-badge">Powered by Groq</span>
                    </div>
                  )}

                  <div className="bubble-prose-text">
                    {msg.content.split('\n\n').map((para, pIdx) => (
                      <p key={pIdx}>{para}</p>
                    ))}
                  </div>

                  {/* Verified Catalogue Recommendations */}
                  {msg.recommendedBooks && msg.recommendedBooks.length > 0 && (
                    <div className="bubble-recommendations-cluster">
                      <div className="recommendations-cluster-title">
                        <span>Verified Catalogue Recommendations:</span>
                      </div>
                      <div className="recommendations-cluster-grid">
                        {msg.recommendedBooks.map((book) => (
                          <div key={book.id} className="assistant-book-card">
                            <div className="assistant-card-cover">
                              {book.cover_image ? (
                                <img
                                  src={book.cover_image}
                                  alt={`Cover of ${book.title}`}
                                  className="assistant-cover-thumb"
                                />
                              ) : (
                                <div className="assistant-cover-placeholder">✦</div>
                              )}
                            </div>
                            <div className="assistant-card-info">
                              <h3 className="assistant-card-title">{book.title}</h3>
                              <p className="assistant-card-author">{book.author}</p>
                              <div className="assistant-card-footer">
                                <span className="assistant-card-price">${book.price}</span>
                                <Link
                                  to={`/books/${book.id}`}
                                  className="assistant-card-view-btn"
                                  id={`link-assistant-book-${book.id}`}
                                >
                                  View Volume →
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* In-Flight Loading Indicator */}
            {loading && (
              <div className="chat-bubble-row row-assistant">
                <div className="assistant-avatar" aria-hidden="true">✦</div>
                <div className="chat-bubble bubble-assistant bubble-loading">
                  <div className="assistant-typing-dots">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                  <span className="typing-label">Consulting AETHERIUM archives via Groq...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="assistant-error-banner" role="alert">
            <span className="error-icon" aria-hidden="true">⚠️</span>
            <span className="error-text">{error}</span>
            <button
              type="button"
              onClick={() => handleSendMessage()}
              className="btn-assistant-retry"
              id="btn-assistant-error-retry"
            >
              Retry
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="assistant-input-tray">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="assistant-input-form"
          >
            <div className="assistant-textarea-wrapper">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedBook
                    ? `Ask about "${selectedBook.title}" or related literary themes...`
                    : 'Ask about literature, themes, or request book recommendations...'
                }
                rows={1}
                maxLength={1000}
                disabled={loading}
                className="assistant-textarea"
                id="assistant-chat-input"
                aria-label="Message to AETHERIUM Reading Assistant"
              />
              <span className="assistant-char-counter">
                {inputMessage.length}/1000
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="btn-assistant-send"
              id="btn-assistant-send"
              aria-label="Send message to Reading Assistant"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
          <div className="assistant-keyboard-hint">
            Press <kbd>Enter</kbd> to send, <kbd>Shift + Enter</kbd> for a new line. Answers are synthesized from catalogue records.
          </div>
        </div>
      </div>
    </div>
  );
}
