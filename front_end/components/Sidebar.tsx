import React, { useState } from "react";

type Conversation = {
  id: string;
  name: string;
  updatedAt: Date;
};

type SidebarProps = {
  conversations: Conversation[];
  onNewConversation: () => void;
  onRenameConversation: (id: string, newName: string) => void;
  onDeleteConversation: (id: string) => void;
  onConversationClick: (id: string) => void;
  currentConversationId: string | null;
  className?: string;
};

const Sidebar = React.memo(
  ({
    conversations = [],
    onNewConversation,
    onRenameConversation,
    onDeleteConversation,
    onConversationClick,
    currentConversationId,
    className = "",
  }: SidebarProps) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    const handleRename = (id: string) => {
      setEditingId(id);
      setEditName(conversations.find((c) => c.id === id)?.name || "");
    };

    const submitRename = (id: string) => {
      onRenameConversation(id, editName);
      setEditingId(null);
    };

    return (
      <div
        className={`w-64 bg-gray-800 p-4 flex flex-col h-full text-gray-300 ${className}`}
      >
        <button
          onClick={onNewConversation}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
        >
          New Conversation
        </button>
        <div className="flex-1 overflow-y-auto">
          {conversations.length > 0 ? (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`cursor-pointer py-2 px-4 hover:bg-gray-700 rounded mb-2 ${
                  currentConversationId === conversation.id ? "bg-gray-700" : ""
                }`}
              >
                {editingId === conversation.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => submitRename(conversation.id)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && submitRename(conversation.id)
                    }
                    className="w-full p-1 border rounded bg-gray-600 text-white"
                    autoFocus
                  />
                ) : (
                  <div onClick={() => onConversationClick(conversation.id)}>
                    {conversation.name ||
                      `Conversation ${conversation.id.slice(0, 8)}...`}
                    <br />
                    <small className="text-gray-400">
                      {new Date(conversation.updatedAt).toLocaleString()}
                    </small>
                  </div>
                )}
                <div className="mt-1">
                  <button
                    onClick={() => handleRename(conversation.id)}
                    className="text-xs text-blue-400 mr-2 hover:text-blue-300"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => onDeleteConversation(conversation.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-400">No conversations yet.</p>
          )}
        </div>
      </div>
    );
  }
);

Sidebar.displayName = "Sidebar";

export default Sidebar;
