import React, { useState, useEffect } from 'react';
import { useAuth } from '../Auth/AuthProvider';
import { MyceliumAPI } from '../../services/mycelium';

export const Header: React.FC = () => {
  const { myceliumProfile, logout } = useAuth();
  const [myceliumStatus, setMyceliumStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [myceliumAPI] = useState(() => new MyceliumAPI());

  useEffect(() => {
    checkMyceliumStatus();
    const interval = setInterval(checkMyceliumStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const checkMyceliumStatus = async () => {
    const isAvailable = await myceliumAPI.isAvailable();
    setMyceliumStatus(isAvailable ? 'connected' : 'disconnected');
  };

  const getStatusColor = () => {
    switch (myceliumStatus) {
      case 'connected': return 'bg-green-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  const getStatusText = () => {
    switch (myceliumStatus) {
      case 'connected': return 'Connected to Mycelium';
      case 'disconnected': return 'Mycelium Disconnected';
      default: return 'Checking Connection...';
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            Mycelium Chat
          </h1>
        </div>

        {/* Status and User Menu */}
        <div className="flex items-center space-x-4">
          {/* Mycelium Status */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span className="text-sm text-gray-600">
              {getStatusText()}
            </span>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <img
                src={myceliumProfile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${myceliumProfile?.displayName}`}
                alt={myceliumProfile?.displayName}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-sm font-medium text-gray-700">
                {myceliumProfile?.displayName}
              </span>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {myceliumProfile?.displayName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {myceliumProfile?.myceliumAddress}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    // TODO: Implement status change
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Change Status
                </button>
                
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    // TODO: Implement settings
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Settings
                </button>
                
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
