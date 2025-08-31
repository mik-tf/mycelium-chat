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
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
    
    // Add some demo contacts for testing
    const demoContacts: Contact[] = [
      {
        id: 'demo-user-1',
        profile: {
          tfConnectId: 'demo.3bot',
          myceliumAddress: 'demo-mycelium-address',
          displayName: 'Demo User',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
          status: 'online',
          visibility: 'public',
          groups: [],
          lastSeen: Date.now(),
          publicKey: 'demo-public-key'
        },
        unreadCount: 0
      }
    ];
    
    if (!stored || JSON.parse(stored).length === 0) {
      setContacts(demoContacts);
      localStorage.setItem('mycelium_contacts', JSON.stringify(demoContacts));
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

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    // Simulate TF Connect ID search
    if (term.includes('.3bot') || term.includes('3bot')) {
      // Mock search result for TF Connect IDs
      const mockResult: Contact = {
        id: `search-${term}`,
        profile: {
          tfConnectId: term.includes('.3bot') ? term : `${term}.3bot`,
          myceliumAddress: `mock-address-${term}`,
          displayName: term.replace('.3bot', ''),
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${term}`,
          status: 'offline',
          visibility: 'public',
          groups: [],
          lastSeen: Date.now(),
          publicKey: 'mock-public-key'
        },
        unreadCount: 0
      };
      
      setTimeout(() => {
        setSearchResults([mockResult]);
        setIsSearching(false);
      }, 500);
    } else {
      setTimeout(() => {
        setSearchResults([]);
        setIsSearching(false);
      }, 500);
    }
  };
  
  const addContactFromSearch = (contact: Contact) => {
    const updatedContacts = [...contacts, contact];
    setContacts(updatedContacts);
    localStorage.setItem('mycelium_contacts', JSON.stringify(updatedContacts));
    setSearchResults([]);
    setSearchTerm('');
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

  const filteredContacts = searchTerm ? 
    contacts.filter(contact =>
      contact.profile.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.profile.tfConnectId.toLowerCase().includes(searchTerm.toLowerCase())
    ) : contacts;

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
      </div>
      
      <div className="p-4">
        <Search
          placeholder="Search contacts or add TF Connect ID (e.g., username.3bot)..."
          value={searchTerm}
          onChange={handleSearch}
        />
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg bg-white">
            <div className="p-2 text-xs text-gray-500 border-b border-gray-100">
              Search Results - Click to add:
            </div>
            {searchResults.map((result) => (
              <div
                key={result.id}
                onClick={() => addContactFromSearch(result)}
                className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center space-x-3">
                  <Avatar
                    src={result.profile.avatar}
                    name={result.profile.displayName}
                    size="sm"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{result.profile.displayName}</div>
                    <div className="text-xs text-blue-600">{result.profile.tfConnectId}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {isSearching && (
          <div className="mt-2 p-3 text-center text-sm text-gray-500">
            Searching for TF Connect users...
          </div>
        )}
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto">
        <ConversationList>
        {filteredContacts.length === 0 && !searchTerm && (
          <div className="p-4 text-center text-gray-500 text-sm">
            No contacts yet. Search for TF Connect IDs to add friends!
          </div>
        )}
        {filteredContacts.map((contact) => (
          <Conversation
            key={contact.id}
            name={contact.profile.displayName}
            lastSenderName={contact.lastMessage?.sender}
            info={contact.lastMessage?.message || 'No messages yet'}
            active={selectedContact?.id === contact.id}
            onClick={() => onContactSelect(contact)}
          >
            <Avatar
              src={contact.profile.avatar}
              name={contact.profile.displayName}
              status={contact.profile.status === 'online' ? 'available' : 'unavailable'}
            />
            <Conversation.Content
              name={contact.profile.displayName}
              info={contact.profile.tfConnectId}
            />
            <div className="absolute bottom-0 right-0">
              <div className={`w-3 h-3 rounded-full border-2 border-white ${getStatusColor(contact.profile.status)}`} />
            </div>
          </Conversation>
        ))}
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
