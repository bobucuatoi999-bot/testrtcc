import { useState, useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUserId: string;
}

export default function Chat({ messages, onSendMessage, currentUserId }: ChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 rounded-lg border border-slate-700">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white">Chat</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${
              message.type === 'system'
                ? 'text-center text-slate-400 text-sm italic'
                : message.userId === currentUserId
                ? 'ml-auto max-w-[80%]'
                : 'mr-auto max-w-[80%]'
            }`}
          >
            {message.type === 'message' && (
              <div
                className={`rounded-lg p-2 ${
                  message.userId === currentUserId
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-700 text-slate-200'
                }`}
              >
                <div className="text-xs font-medium mb-1 opacity-75">
                  {message.userId === currentUserId ? 'You' : message.displayName}
                </div>
                <div>{message.message}</div>
              </div>
            )}
            {message.type === 'system' && (
              <div className="text-xs text-slate-500">{message.message}</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

