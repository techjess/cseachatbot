"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import toast, { Toaster } from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "./Sidebar";
import { useDebounce } from "use-debounce";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  conversationId: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  name: string;
  messages: Message[];
  updatedAt: Date;
};

type ChatInterfaceProps = {
  initialConversations: Conversation[];
};

export default function ChatInterface({
  initialConversations = [],
}: ChatInterfaceProps) {
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [input, setInput] = useState("");
  const [debouncedInput] = useDebounce(input, 300);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);
  const MAX_CONTEXT_MESSAGES = 10;

  const connectWebSocket = useCallback(() => {
    if (!session?.user?.email || isConnecting) return;

    setIsConnecting(true);
    const newSocket = new WebSocket(
      `ws://aicragnet.com:8088/ws/${encodeURIComponent(session.user.email)}`
    );

    newSocket.onopen = () => {
      console.log("WebSocket connection established");
      setSocket(newSocket);
      setIsConnecting(false);
    };

    newSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setConversations((prevConversations) => {
        return prevConversations.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: [
                  ...conv.messages,
                  {
                    id: Date.now().toString(),
                    content: data.message,
                    sender: "ai" as const, // Explicitly type as "ai"
                    conversationId: conv.id,
                    createdAt: new Date().toISOString(),
                  },
                ],
                updatedAt: new Date(),
              }
            : conv
        );
      });
    };

    newSocket.onclose = (event) => {
      console.log("WebSocket connection closed");
      setSocket(null);
      setIsConnecting(false);

      if (!event.wasClean) {
        setTimeout(() => connectWebSocket(), 5000);
      }
    };

    newSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      newSocket.close();
    };
  }, [session?.user?.email, isConnecting, currentConversationId]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [connectWebSocket, socket]);

  useEffect(() => {
    const conversationId = searchParams.get("id");
    if (conversationId && !initialLoadRef.current) {
      setCurrentConversationId(conversationId);
      loadMessages(conversationId, 1);
      initialLoadRef.current = true;
    } else if (conversations.length > 0 && !initialLoadRef.current) {
      setCurrentConversationId(conversations[0].id);
      loadMessages(conversations[0].id, 1);
      initialLoadRef.current = true;
    }
  }, [searchParams, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations]);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch("/api/conversation");
        if (!response.ok) {
          throw new Error("Failed to fetch conversations");
        }
        const data = await response.json();
        setConversations(data);
        if (data.length > 0 && !currentConversationId) {
          setCurrentConversationId(data[0].id);
          loadMessages(data[0].id, 1);
        }
      } catch (error) {
        console.error("Error fetching conversations:", error);
        toast.error("Failed to load conversations");
      }
    };

    fetchConversations();
  }, []);

  const loadMessages = useCallback(
    async (conversationId: string, pageNum: number) => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/conversation/${conversationId}/messages?page=${pageNum}`
        );
        if (!response.ok) {
          throw new Error("Failed to load messages");
        }

        const data = await response.json();

        setConversations((prevConversations) => {
          return prevConversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages:
                    pageNum === 1
                      ? data.messages
                      : [...data.messages, ...conv.messages],
                }
              : conv
          );
        });

        setPage(pageNum);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error("Error loading messages:", error);
        toast.error("Failed to load messages");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  const currentMessages =
    conversations.find((conv) => conv.id === currentConversationId)?.messages ||
    [];

  const getContextMessages = useCallback(() => {
    console.log("Current messages:", currentMessages); // Add this line
    const relevantMessages = currentMessages.slice(-MAX_CONTEXT_MESSAGES);
    console.log("Relevant messages:", relevantMessages); // Add this line
    return relevantMessages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content,
    }));
  }, [currentMessages]);

  const sendMessage = async () => {
    if (!debouncedInput.trim() || isLoading || !session?.user?.email) return;

    setIsLoading(true);
    setError(null);

    try {
      const contextMessages = getContextMessages();

      console.log("Context being sent:", contextMessages);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: debouncedInput,
          conversationId: currentConversationId,
          context: contextMessages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();

      setConversations((prevConversations) => {
        let updatedConversations;

        if (
          !currentConversationId ||
          !prevConversations.some((conv) => conv.id === currentConversationId)
        ) {
          updatedConversations = [
            {
              id: data.conversationId,
              name: "New Conversation",
              messages: [data.userMessage, data.aiMessage],
              updatedAt: new Date(),
            },
            ...prevConversations,
          ];
          setCurrentConversationId(data.conversationId);
          router.push(`/chat?id=${data.conversationId}`);
        } else {
          updatedConversations = prevConversations.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  messages: [
                    ...conv.messages,
                    data.userMessage,
                    data.aiMessage,
                  ],
                  updatedAt: new Date(),
                }
              : conv
          );
        }

        return updatedConversations;
      });

      setInput("");
      setPage(1);
      setHasMore(true);
      toast.success("Message sent successfully");
    } catch (error) {
      console.error("Error:", error);
      setError(error instanceof Error ? error.message : String(error));
      toast.error(
        `Failed to send message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = useCallback(async () => {
    try {
      const response = await fetch("/api/conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "New Conversation" }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server response:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newConversation = await response.json();
      setConversations((prev) => [newConversation, ...prev]);
      setCurrentConversationId(newConversation.id);
      router.push(`/chat?id=${newConversation.id}`);
      toast.success("New conversation created");
    } catch (error) {
      console.error("Error creating new conversation:", error);
      toast.error(
        `Failed to create new conversation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [router]);

  const renameConversation = useCallback(
    async (id: string, newName: string) => {
      try {
        const response = await fetch(`/api/conversation/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: newName }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error ||
              `Failed to rename conversation: ${response.status}`
          );
        }

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === id ? { ...conv, name: newName } : conv
          )
        );

        toast.success("Conversation renamed successfully");
      } catch (error) {
        console.error("Error renaming conversation:", error);
        setError(error instanceof Error ? error.message : String(error));
        toast.error(
          `Failed to rename conversation: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
    []
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/conversation/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error ||
              `Failed to delete conversation: ${response.status}`
          );
        }

        setConversations((prev) => prev.filter((conv) => conv.id !== id));

        if (currentConversationId === id) {
          const nextConversation = conversations.find((conv) => conv.id !== id);
          if (nextConversation) {
            setCurrentConversationId(nextConversation.id);
            router.push(`/chat?id=${nextConversation.id}`);
          } else {
            setCurrentConversationId(null);
            router.push("/chat");
          }
        }

        toast.success("Conversation deleted successfully");
      } catch (error) {
        console.error("Error deleting conversation:", error);
        setError(error instanceof Error ? error.message : String(error));
        toast.error(
          `Failed to delete conversation: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
    [conversations, currentConversationId, router]
  );

  const loadMoreMessages = async () => {
    if (!currentConversationId || !hasMore) return;
    await loadMessages(currentConversationId, page + 1);
  };

  const handleLogout = () => {
    router.push("/");
  };

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleConversationClick = useCallback(
    (id: string) => {
      setCurrentConversationId(id);
      router.push(`/chat?id=${id}`);
      loadMessages(id, 1);
    },
    [router, loadMessages]
  );

  return (
    <div className="flex flex-col sm:flex-row h-screen bg-gray-900 text-gray-100">
      <Toaster position="top-right" />
      <Sidebar
        conversations={conversations}
        onNewConversation={startNewConversation}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        onConversationClick={handleConversationClick}
        currentConversationId={currentConversationId}
        className="w-full sm:w-64 bg-gray-800 border-b sm:border-r border-gray-700"
      />
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-none p-4 bg-gray-800 flex justify-between items-center">
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm"
          >
            Logout
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-900">
          {error && (
            <div className="bg-red-500 text-white p-2 mb-4 rounded">
              Error: {error}
            </div>
          )}
          {hasMore && (
            <button
              onClick={loadMoreMessages}
              className="w-full text-center text-blue-500 hover:text-blue-600 mb-4"
            >
              Load more messages
            </button>
          )}
          {currentMessages.map((message) => (
            <div
              key={message.id}
              className={`mb-4 ${
                message.sender === "user" ? "text-right" : "text-left"
              }`}
            >
              <span
                className={`inline-block p-2 rounded-lg max-w-[80%] ${
                  message.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-100"
                }`}
              >
                {message.content}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          <div className="flex">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 bg-gray-700 text-gray-100 border border-gray-600 rounded-l px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type your message..."
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
