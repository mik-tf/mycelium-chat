import React, { useState, useEffect, useRef } from 'react';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
  Avatar
} from '@chatscope/chat-ui-kit-react';
import { v4 as uuid } from 'uuid';
import type { ChatMessage, Contact, MyceliumChatProfile } from '../../types';
import { MyceliumAPI } from '../../services/mycelium';
import { useAuth } from '../Auth/AuthProvider';

interface ChatInterfaceProps {
  selectedContact: Contact | null;
  onContactSelect: (contact: Contact) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  selectedContact,
  onContactSelect
}) => {
  const { myceliumProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [myceliumAPI] = useState(() => new MyceliumAPI());
  const messageListRef = useRef<any>(null);

  useEffect(() => {
    if (selectedContact) {
      loadChatHistory(selectedContact.id);
      startMessageListener();
    }
  }, [selectedContact]);

  const loadChatHistory = (contactId: string) => {
    // Load messages from localStorage for now
    const stored = localStorage.getItem(`chat_${contactId}`);
    if (stored) {
      setMessages(JSON.parse(stored));
    } else {
      setMessages([]);
    }
  };

  const saveMessage = (message: ChatMessage) => {
    if (!selectedContact) return;
    
    const updated = [...messages, message];
    setMessages(updated);
    localStorage.setItem(`chat_${selectedContact.id}`, JSON.stringify(updated));
  };

  const startMessageListener = () => {
    if (!selectedContact) return;

    const listenForMessages = async () => {
      try {
        const topic = `chat.direct.${selectedContact.profile.tfConnectId}`;
        const receivedMessages = await myceliumAPI.receiveMessages(5, topic);
        
        for (const msg of receivedMessages) {
          const chatMessage: ChatMessage = {
            id: msg.id,
            message: atob(msg.payload),
            sentTime: new Date(msg.timestamp || Date.now()).toISOString(),
            sender: selectedContact.profile.displayName,
            direction: 'incoming',
            status: 'delivered'
          };
          
          saveMessage(chatMessage);
        }
      } catch (error) {
        console.warn('Error receiving messages:', error);
      }
      
      // Continue listening if contact is still selected
      if (selectedContact) {
        setTimeout(listenForMessages, 2000);
      }
    };

    listenForMessages();
  };

  const handleSendMessage = async (text: string) => {
    if (!selectedContact || !myceliumProfile || !text.trim()) return;

    const messageId = uuid();
    const chatMessage: ChatMessage = {
      id: messageId,
      message: text,
      sentTime: new Date().toISOString(),
      sender: 'You',
      direction: 'outgoing',
      status: 'sending'
    };

    // Add message to UI immediately
    saveMessage(chatMessage);

    try {
      // Send via Mycelium
      const topic = `chat.direct.${selectedContact.profile.tfConnectId}`;
      const result = await myceliumAPI.sendMessage(
        selectedContact.profile.myceliumAddress,
        text,
        topic
      );

      // Update message status
      const updatedMessages = messages.map(msg => 
        msg.id === messageId 
          ? { ...msg, status: result.success ? 'sent' : 'failed' }
          : msg
      );
      setMessages(updatedMessages);
      
      if (selectedContact) {
        localStorage.setItem(`chat_${selectedContact.id}`, JSON.stringify(updatedMessages));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Mark message as failed
      const updatedMessages = messages.map(msg => 
        msg.id === messageId ? { ...msg, status: 'failed' } : msg
      );
      setMessages(updatedMessages);
      
      if (selectedContact) {
        localStorage.setItem(`chat_${selectedContact.id}`, JSON.stringify(updatedMessages));
      }
    }
  };

  if (!selectedContact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Welcome to Mycelium Chat
          </h3>
          <p className="text-gray-500">
            Select a contact to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center space-x-3">
        <Avatar
          src={selectedContact.profile.avatar}
          name={selectedContact.profile.displayName}
          size="sm"
        />
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">
            {selectedContact.profile.displayName}
          </h3>
          <p className="text-sm text-gray-500">
            {selectedContact.profile.status === 'online' ? 'Online' : 'Last seen recently'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            selectedContact.profile.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
          }`} />
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-hidden">
        <MainContainer>
          <ChatContainer>
            <MessageList
              ref={messageListRef}
              typingIndicator={isTyping ? <TypingIndicator content={`${selectedContact.profile.displayName} is typing`} /> : null}
            >
              {messages.map((message) => (
                <Message
                  key={message.id}
                  model={{
                    message: message.message,
                    sentTime: message.sentTime,
                    sender: message.sender,
                    direction: message.direction,
                    position: "single"
                  }}
                >
                  <Avatar
                    src={message.direction === 'incoming' ? selectedContact.profile.avatar : myceliumProfile?.avatar}
                    name={message.sender}
                    size="xs"
                  />
                  {message.status && message.direction === 'outgoing' && (
                    <Message.Footer>
                      <div className="text-xs text-gray-500">
                        {message.status === 'sending' && '⏳ Sending...'}
                        {message.status === 'sent' && '✓ Sent'}
                        {message.status === 'delivered' && '✓✓ Delivered'}
                        {message.status === 'failed' && '❌ Failed'}
                      </div>
                    </Message.Footer>
                  )}
                </Message>
              ))}
            </MessageList>
            <MessageInput
              placeholder="Type your message..."
              onSend={handleSendMessage}
              attachButton={false}
            />
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
};
