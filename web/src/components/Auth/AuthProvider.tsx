import React, { createContext, useContext, useEffect, useState } from 'react';
import type { TFConnectProfile, MyceliumChatProfile } from '../../types';
import { TFConnectAuth } from '../../services/tfconnect';
import { UserDiscoveryService } from '../../services/discovery';

interface AuthContextType {
  isAuthenticated: boolean;
  tfProfile: TFConnectProfile | null;
  myceliumProfile: MyceliumChatProfile | null;
  login: () => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tfProfile, setTfProfile] = useState<TFConnectProfile | null>(null);
  const [myceliumProfile, setMyceliumProfile] = useState<MyceliumChatProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tfConnectAuth] = useState(() => new TFConnectAuth());
  const [discoveryService] = useState(() => new UserDiscoveryService());

  useEffect(() => {
    initializeAuth();
    handleAuthCallback();
  }, []);

  const initializeAuth = async () => {
    try {
      if (tfConnectAuth.isAuthenticated()) {
        const profile = tfConnectAuth.getCurrentProfile();
        if (profile) {
          setTfProfile(profile);
          setMyceliumProfile(tfConnectAuth.createMyceliumProfile(profile));
          setIsAuthenticated(true);
          
          // Initialize discovery service
          await discoveryService.initialize(profile);
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthCallback = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      setLoading(true);
      try {
        const result = await tfConnectAuth.handleCallback(code, state);
        if (result.success && result.profile) {
          setTfProfile(result.profile);
          setMyceliumProfile(tfConnectAuth.createMyceliumProfile(result.profile));
          setIsAuthenticated(true);
          
          // Initialize discovery service
          await discoveryService.initialize(result.profile);
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          console.error('Authentication failed:', result.error);
        }
      } catch (error) {
        console.error('Callback handling failed:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const login = async () => {
    await tfConnectAuth.login();
  };

  const logout = () => {
    tfConnectAuth.logout();
    discoveryService.stop();
    setIsAuthenticated(false);
    setTfProfile(null);
    setMyceliumProfile(null);
  };

  const value: AuthContextType = {
    isAuthenticated,
    tfProfile,
    myceliumProfile,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
