import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GOOGLE_AI_API_KEY;

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Khởi tạo Gemini với model mới (stable, nhanh, miễn phí)
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash'  // Model mới: Nhanh, 1M token context, thay thế 1.5-flash
  });

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Kiểm tra API key
    if (!API_KEY) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lỗi: API key Google AI chưa được cấu hình!' }]);
      setIsLoading(false);
      return;
    }

    try {
      // Chuyển lịch sử chat thành định dạng Gemini  
      const chatHistory = newMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      // Bắt đầu chat session với config tối ưu cho 2.0 Flash
      const chat = model.startChat({
        history: chatHistory,
        generationConfig: {
          maxOutputTokens: 500,  // Tăng limit cho model mới (từ 200)
          temperature: 0.7,
          topP: 0.8,  // Thêm topP cho chất lượng tốt hơn
        },
      });

      // Gửi tin nhắn cuối
      const result = await chat.sendMessage(userMessage.content);
      const response = await result.response;
      const text = response.text();

      const aiMessage = { role: 'assistant', content: text };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Lỗi Google AI:', error);
      let errMsg = 'Không thể kết nối đến Google AI.';
      
      // Xử lý lỗi cụ thể từ API mới
      if (error.message.includes('quotaExceeded')) {
        errMsg = 'Đã hết quota sử dụng miễn phí. Nâng cấp lên Google One AI Premium.';
      } else if (error.message.includes('invalid_argument')) {
        errMsg = 'Yêu cầu không hợp lệ. Kiểm tra input.';
      } else {
        errMsg = error.message;
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: `Lỗi: ${errMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{  margin: '0 auto', padding: '10px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#1a73e8' }}>Chatbot HTA</h2>
      
      <div
        style={{
          height: '620px',
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: '12px',
          padding: '12px',
          marginBottom: '12px',
          backgroundColor: '#f9f9f9',
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>
            Hãy bắt đầu cuộc trò chuyện với HTA AI
          </p>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              marginBottom: '12px',
              textAlign: msg.role === 'user' ? 'right' : 'left',
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: '18px',
                backgroundColor: msg.role === 'user' ? '#1a73e8' : '#e0e0e0',
                color: msg.role === 'user' ? 'white' : 'black',
                wordWrap: 'break-word',
              }}
            >
              <strong>{msg.role === 'user' ? 'Bạn' : 'HTA'}:</strong>{' '}
              <span style={{ marginLeft: '4px' }}>{msg.content}</span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ textAlign: 'left' }}>
            <div
              style={{
                display: 'inline-block',
                padding: '10px 14px',
                borderRadius: '18px',
                backgroundColor: '#e0e0e0',
                color: '#555',
              }}
            >
              Gemini đang suy nghĩ
              <span style={{ animation: 'dots 1.5s infinite' }}>...</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Nhập tin nhắn..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '12px',
            outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '12px 20px',
            fontSize: '16px',
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !input.trim() ? 0.6 : 1,
          }}
        >
          Gửi
        </button>
      </div>

      <style>
        {`
          @keyframes dots {
            0%, 20% { content: ''; }
            40% { content: '.'; }
            60% { content: '..'; }
            80%, 100% { content: '...'; }
          }
          span[style*="animation"]::after {
            content: '';
            animation: dots 1.5s infinite;
          }
        `}
      </style>
    </div>
  );
};

export default Chatbot;