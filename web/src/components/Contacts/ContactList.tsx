import React, { useState, useEffect } from 'react';
import {
  ConversationList,
  Conversation,
  Avatar,
  Search
} from '@chatscope/chat-ui-kit-react';
import type { Contact, MyceliumChatProfile } from '../../types';
import { UserDiscoveryService } from '../../services/discovery';

interface ContactListProps {
  selectedContact: Contact | null;
  onContactSelect: (contact: Contact) => void;
}

export const ContactList: React.FC<ContactListProps> = ({
  selectedContact,
  onContactSelect
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [_discoveryService] = useState(() => new UserDiscoveryService());

  useEffect(() => {
    loadContacts();
    startDiscoveryListener();
  }, []);

  const loadContacts = () => {
    // Load contacts from localStorage
    const stored = localStorage.getItem('mycelium_contacts');
    if (stored) {
      setContacts(JSON.parse(stored));
    }
  };

  const startDiscoveryListener = () => {
    const handleUserDiscovered = (event: CustomEvent) => {
      const profile: MyceliumChatProfile = event.detail;
      addOrUpdateContact(profile);
    };

    window.addEventListener('user_discovered', handleUserDiscovered as EventListener);

    return () => {
      window.removeEventListener('user_discovered', handleUserDiscovered as EventListener);
    };
  };

  const addOrUpdateContact = (profile: MyceliumChatProfile) => {
    setContacts(prev => {
      const existing = prev.find(c => c.profile.tfConnectId === profile.tfConnectId);
      
      if (existing) {
        // Update existing contact
        const updated = prev.map(c => 
          c.profile.tfConnectId === profile.tfConnectId
            ? { ...c, profile }
            : c
        );
        localStorage.setItem('mycelium_contacts', JSON.stringify(updated));
        return updated;
      } else {
        // Add new contact
        const newContact: Contact = {
          id: profile.tfConnectId,
          profile,
          unreadCount: 0
        };
        const updated = [...prev, newContact];
        localStorage.setItem('mycelium_contacts', JSON.stringify(updated));
        return updated;
      }
    });
  };

  const filteredContacts = contacts.filter(contact =>
    contact.profile.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Contacts
        </h2>
        <Search
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(value) => setSearchTerm(value)}
        />
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto">
        <ConversationList>
          {filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <div className="mb-2">
                <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-sm">No contacts found</p>
              <p className="text-xs mt-1">
                Users will appear here as they come online
              </p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <Conversation
                key={contact.id}
                name={contact.profile.displayName}
                lastSenderName={contact.lastMessage?.sender}
                info={contact.lastMessage?.message || 'No messages yet'}
                active={selectedContact?.id === contact.id}
                unreadCnt={contact.unreadCount}
                onClick={() => onContactSelect(contact)}
              >
                <Avatar
                  src={contact.profile.avatar}
                  name={contact.profile.displayName}
                  status="available"
                />
                <div className="absolute bottom-0 right-0">
                  <div className={`w-3 h-3 rounded-full border-2 border-white ${getStatusColor(contact.profile.status)}`} />
                </div>
              </Conversation>
            ))
          )}
        </ConversationList>
      </div>

      {/* Discovery Status */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{filteredContacts.length} contacts</span>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Discovering users...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
