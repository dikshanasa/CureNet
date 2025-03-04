import React, { useState } from "react";
import { Menu, Send, AlertCircle } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown"; // Import react-markdown for rendering markdown

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  sources?: Array<{
    title: string;
    link: string;
  }>;
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      content: input,
      sender: "user" as const,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: input, location: "us" }),
      });

      const data = await response.json();

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        content: data.answer,
        sender: "ai" as const,
        timestamp: new Date(),
        sources: data.sources,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-gray-50">
      {/* Disclaimer Banner */}
      <div className="bg-red-50 border-b border-red-100">
        <div className="max-w-4xl mx-auto p-2.5 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>
            <span className="font-semibold">Disclaimer:</span> This is not
            medical advice. Information provided is based on data from various
            sources.
          </p>
        </div>
      </div>

      {/* Header */}
      <header className="flex items-center px-6 py-4 bg-white border-b border-gray-100">
        <button className="p-2 hover:bg-gray-50 rounded-lg">
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-8 h-8 bg-[#4C7BF4] rounded-lg flex items-center justify-center">
            <span className="text-white font-semibold">C</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">CureNet</h1>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto px-6 py-4 bg-white">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              } mb-4`}
            >
              {/* Message Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.sender === "user"
                    ? "bg-[#4C7BF4] text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                {/* Render User or AI Content */}
                {message.sender === "ai" ? (
                  // Use ReactMarkdown to render markdown-formatted AI responses
                  <ReactMarkdown className="text-sm">{message.content}</ReactMarkdown>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}

                {/* Render Sources for AI Messages */}
                {message.sender === "ai" && message.sources && (
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 font-medium">Sources:</p>
                    <div className="mt-1 space-y-1">
                      {message.sources.map((source, index) => (
                        <a
                          key={index}
                          href={source.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-blue-500 hover:underline"
                        >
                          {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <div className="px-6 py-4 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto flex gap-3">
          <TextareaAutosize
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your medical query here..."
            className="flex-1 resize-none rounded-full border border-gray-200 focus:border-[#4C7BF4] focus:ring-[#4C7BF4] px-6 py-3 text-gray-600 text-sm"
            maxRows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-[#4C7BF4] text-white rounded-full hover:bg-[#4C7BF4]/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
