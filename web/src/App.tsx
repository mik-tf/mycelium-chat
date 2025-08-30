import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/Auth/AuthProvider';
import { LoginScreen } from './components/Auth/LoginScreen';
import { Header } from './components/Common/Header';
import { ContactList } from './components/Contacts/ContactList';
import { ChatInterface } from './components/Chat/ChatInterface';
import type { Contact } from './types';

const MainApp: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Mycelium Chat...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <ContactList
          selectedContact={selectedContact}
          onContactSelect={setSelectedContact}
        />
        <ChatInterface
          selectedContact={selectedContact}
          onContactSelect={setSelectedContact}
        />
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
