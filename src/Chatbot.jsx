import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './chatbot.css'; // Import CSS

const API_KEY = import.meta.env.VITE_GOOGLE_AI_API_KEY;
const STORAGE_KEY = 'hta_chat_history';

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // NEW: Mobile menu
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // === LOAD SESSIONS ===
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      if (parsed.length > 0) {
        const latest = parsed[0];
        setCurrentSessionId(latest.id);
        setMessages(latest.messages);
      }
    }
  }, []);

  // === AUTO SCROLL ===
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // === SAVE SESSION ===
  const saveSession = (updatedMessages) => {
    const now = new Date();
    const sessionTitle = updatedMessages[0]?.content.slice(0, 20) + '...' || 'Phiên mới';

    const newSession = {
      id: currentSessionId || Date.now().toString(),
      title: sessionTitle,
      messages: updatedMessages,
      timestamp: now.toISOString(),
      preview: updatedMessages[updatedMessages.length - 1]?.content.slice(0, 40) + '...'
    };

    let updatedSessions = currentSessionId
      ? sessions.map(s => s.id === currentSessionId ? newSession : s)
      : [newSession, ...sessions];

    setSessions(updatedSessions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
    if (!currentSessionId) setCurrentSessionId(newSession.id);
  };

  // === SEND MESSAGE ===
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    saveSession(newMessages);

    if (!API_KEY) {
      const err = { role: 'assistant', content: 'Lỗi: API key chưa được cấu hình!' };
      setMessages(prev => [...prev, err]);
      saveSession([...newMessages, err]);
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    try {
      const chatHistory = newMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      const chat = model.startChat({
        history: chatHistory,
        generationConfig: { maxOutputTokens: 500, temperature: 0.7, topP: 0.8 },
      });

      const result = await chat.sendMessage(userMessage.content);
      const text = (await result.response).text();

      const aiMessage = { role: 'assistant', content: text };
      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);
      saveSession(finalMessages);
    } catch (error) {
      console.error('Lỗi Google AI:', error);
      let errMsg = 'Không thể kết nối đến HTA AI.';
      if (error.message.includes('quotaExceeded')) errMsg = 'Hết quota miễn phí. Thử lại sau.';
      else if (error.message.includes('invalid_argument')) errMsg = 'Tin nhắn không hợp lệ.';

      const err = { role: 'assistant', content: `Lỗi: ${errMsg}` };
      const finalMessages = [...newMessages, err];
      setMessages(finalMessages);
      saveSession(finalMessages);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
      setSidebarOpen(false); // Đóng sidebar sau khi gửi
    }
  };

  // === UTILITIES ===
  const loadSession = (session) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setSidebarOpen(false); // Đóng sidebar trên mobile
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setInput('');
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (iso) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now - date;
    return diff < 86400000
      ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('vi-VN');
  };

  return (
    <>
      <div className="chatbot-container">
        {/* === SIDEBAR === */}
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <button onClick={startNewChat} className="new-chat-btn">
              + Cuộc trò chuyện mới
            </button>
          </div>

          <div className="session-list">
            {sessions.length === 0 ? (
              <p className="empty-sessions">Chưa có cuộc trò chuyện nào</p>
            ) : (
              sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
                >
                  <div className="session-title">{session.title}</div>
                  <div className="session-preview">{session.preview}</div>
                  <div className="session-time">{formatTime(session.timestamp)}</div>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="delete-session-btn"
                    title="Xóa phiên"
                  >
                    X
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* === MAIN CHAT === */}
        <div className="main-chat">
          <div className="chat-header">
            <button 
              className="mobile-menu-btn" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Mở menu"
            >
              {sidebarOpen ? 'Close' : 'Menu'}
            </button>
            <h2>HTA AI Chatbot</h2>
          </div>

          <div className="messages-container">
            {messages.length === 0 ? (
              <p className="empty-state">
                {currentSessionId ? 'Đang tải...' : 'Bắt đầu cuộc trò chuyện mới!'}
              </p>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message-wrapper ${msg.role}`}
                >
                  <div className={`message-bubble ${msg.role}`}>
                    <strong className="message-label">
                      {msg.role === 'user' ? 'Bạn' : 'HTA'}:
                    </strong>{' '}
                    <span>{msg.content}</span>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="message-wrapper assistant">
                <div className="loading-message">
                  HTA đang suy nghĩ<span className="loading-dots"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* === INPUT === */}
          <div className="input-area">
            <div className="input-group">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Nhập tin nhắn..."
                disabled={isLoading}
                className="chat-input"
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="send-btn"
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === MOBILE OVERLAY === */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay open" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};

export default Chatbot;