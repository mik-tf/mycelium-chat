import React, { createContext, useContext, useEffect, useState } from 'react';
import type { TFConnectProfile, MyceliumChatProfile } from '../../types';
import { tfConnectAuth } from '../../services/tfconnect';
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
  const discoveryService = new UserDiscoveryService();

  useEffect(() => {
    initializeAuth();
    handleAuthCallback();
    
    // Listen for TF Connect postMessage events
    const handlePostMessage = (event: MessageEvent) => {
      console.log('Received postMessage:', event);
      
      if (event.data?.message === 'threefoldLoginRedirectSuccess') {
        console.log('TF Connect login successful:', event.data.profileData);
        handleTFConnectSuccess(event.data.profileData);
      }
    };
    
    window.addEventListener('message', handlePostMessage);
    
    return () => {
      window.removeEventListener('message', handlePostMessage);
    };
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
    // Check for demo mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') {
      console.log('Demo mode activated');
      await processCallback(null, null);
      return;
    }

    // Log all URL parameters for debugging
    console.log('Current URL:', window.location.href);
    console.log('All URL params:', Object.fromEntries(urlParams.entries()));
    
    // Check for stored TF Connect authentication result (same-page redirect)
    const storedResult = window.localStorage.getItem('tfconnect_auth_result');
    if (storedResult) {
      try {
        const authResult = JSON.parse(storedResult);
        console.log('🔍 Found stored TF Connect auth result:', authResult);
        
        // Clear the stored result
        window.localStorage.removeItem('tfconnect_auth_result');
        
        // Check if result is recent (within 5 minutes)
        const isRecent = (Date.now() - authResult.timestamp) < 5 * 60 * 1000;
        
        if (authResult.success && authResult.profileData && isRecent) {
          console.log('✅ Processing stored TF Connect authentication...');
          const profile = authResult.profileData;
          
          setTfProfile({
            id: profile.id,
            name: profile.doubleName,
            email: profile.email,
            publicKey: profile.publicKey,
            avatar: profile.avatar
          });
          setMyceliumProfile(tfConnectAuth.createMyceliumProfile({
            id: profile.id,
            name: profile.doubleName,
            email: profile.email,
            publicKey: profile.publicKey,
            avatar: profile.avatar
          }));
          setIsAuthenticated(true);
          return;
        }
      } catch (e) {
        console.error('Error parsing stored auth result:', e);
        window.localStorage.removeItem('tfconnect_auth_result');
      }
    }
    
    // Check for TF Connect callback parameters (fallback)
    const tfConnectParams = {
      signedAttempt: urlParams.get('signedAttempt'),
      doubleName: urlParams.get('doubleName'),
      publicKey: urlParams.get('publicKey'),
      username: urlParams.get('username'),
      email: urlParams.get('email'),
      pubkey: urlParams.get('pubkey'),
      state: urlParams.get('state')
    };
    
    console.log('TF Connect callback parameters:', tfConnectParams);
    
    // Check if we have TF Connect callback data (either format)
    if ((tfConnectParams.signedAttempt && tfConnectParams.doubleName && tfConnectParams.publicKey && tfConnectParams.state) || 
        (tfConnectParams.username && tfConnectParams.email && tfConnectParams.pubkey && tfConnectParams.state)) {
      
      const finalDoubleName = tfConnectParams.doubleName || tfConnectParams.username;
      const finalPublicKey = tfConnectParams.publicKey || tfConnectParams.pubkey;
      
      console.log('Processing TF Connect callback for:', finalDoubleName);
      
      // Process the TF Connect callback
      await processTFConnectCallback(tfConnectParams.signedAttempt || 'mock', finalDoubleName!, finalPublicKey!, tfConnectParams.state!);
      return;
    }
    
    // If no TF Connect data found but we have parameters, this might be the redirect back from TF Connect
    if (urlParams.size > 0) {
      console.log('URL has parameters but not recognized TF Connect format - might need to wait for redirect');
      
      // Check if this looks like a TF Connect redirect (has appid)
      if (urlParams.get('appid') === 'mycelium-chat') {
        console.log('This appears to be a TF Connect redirect - waiting for actual callback...');
        // TF Connect might redirect again with the actual user data
        return;
      }
    }
  };

  const handleTFConnectSuccess = async (profileData: any) => {
    try {
      console.log('Processing TF Connect profile data:', profileData);
      
      // Create TF Connect profile from the postMessage data
      const tfProfile: TFConnectProfile = {
        id: profileData.doubleName || profileData.username || `tf_${Date.now()}`,
        name: profileData.doubleName || profileData.username || 'TF User',
        email: profileData.email || `${profileData.doubleName || 'user'}@threefold.me`,
        publicKey: profileData.publicKey || profileData.pubkey || 'mock_key',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${profileData.doubleName || Date.now()}`
      };

      // Store authentication data
      localStorage.setItem('tf_connect_profile', JSON.stringify(tfProfile));
      localStorage.setItem('tf_connect_authenticated', 'true');

      // Update state
      setTfProfile(tfProfile);
      setMyceliumProfile(tfConnectAuth.createMyceliumProfile(tfProfile));
      setIsAuthenticated(true);

      // Initialize discovery service
      await discoveryService.initialize(tfProfile);

      console.log('TF Connect authentication successful:', tfProfile.name);
    } catch (error) {
      console.error('TF Connect authentication failed:', error);
    }
  };

  const processTFConnectCallback = async (_signedAttempt: string, doubleName: string, publicKey: string, state: string) => {
    try {
      // Verify state parameter
      const storedState = localStorage.getItem('tf_connect_state');
      if (state !== storedState) {
        throw new Error('Invalid state parameter');
      }

      // Create TF Connect profile from callback data
      const tfProfile: TFConnectProfile = {
        id: doubleName,
        name: doubleName,
        email: `${doubleName}@threefold.me`,
        publicKey: publicKey,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${doubleName}`
      };

      // Store authentication data
      localStorage.setItem('tf_connect_profile', JSON.stringify(tfProfile));
      localStorage.setItem('tf_connect_authenticated', 'true');
      localStorage.removeItem('tf_connect_state');

      // Update state
      setTfProfile(tfProfile);
      setMyceliumProfile(tfConnectAuth.createMyceliumProfile(tfProfile));
      setIsAuthenticated(true);

      // Initialize discovery service
      await discoveryService.initialize(tfProfile);

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);

      console.log('TF Connect authentication successful:', doubleName);
    } catch (error) {
      console.error('TF Connect authentication failed:', error);
    }
  };

  const processCallback = async (code: string | null, state: string | null) => {
    if (!code) {
      console.log('No authentication code found, using demo mode');
      // For development, create a demo profile
      const demoProfile: TFConnectProfile = {
        id: `demo_${Date.now()}`,
        name: 'Demo User',
        email: 'demo@example.com',
        publicKey: `pk_${Math.random().toString(36).substring(2)}`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`
      };
      
      setTfProfile(demoProfile);
      setMyceliumProfile(tfConnectAuth.createMyceliumProfile(demoProfile));
      setIsAuthenticated(true);
      
      // Store demo authentication
      localStorage.setItem('tf_connect_profile', JSON.stringify(demoProfile));
      localStorage.setItem('tf_connect_authenticated', 'true');
      
      // Initialize discovery service
      await discoveryService.initialize(demoProfile);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    setLoading(true);
    try {
      const result = await tfConnectAuth.handleCallback(code, state || '');
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
  };

  const login = async () => {
    try {
      const profile = await tfConnectAuth.login();
      
      // Store authentication data
      localStorage.setItem('tf_connect_profile', JSON.stringify(profile));
      localStorage.setItem('tf_connect_authenticated', 'true');

      // Update state
      setTfProfile(profile);
      setMyceliumProfile(tfConnectAuth.createMyceliumProfile(profile));
      setIsAuthenticated(true);

      // Initialize discovery service
      await discoveryService.initialize(profile);

      console.log('TF Connect authentication successful:', profile.name);
    } catch (error) {
      console.error('TF Connect login failed:', error);
      // You might want to show an error message to the user here
    }
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
