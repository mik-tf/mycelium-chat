import React from 'react';
import { useAuth } from './AuthProvider';

export const LoginScreen: React.FC = () => {
  const { login, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Mycelium Chat
          </h1>
          <p className="text-gray-600">
            Decentralized P2P messaging on the Mycelium network
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">
              Prerequisites
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• MyceliumFlut app running locally</li>
              <li>• ThreeFold Connect account</li>
              <li>• Mycelium network connection</li>
            </ul>
          </div>

          <button
            onClick={login}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                </svg>
                <span>Login with ThreeFold Connect</span>
              </>
            )}
          </button>

          <div className="text-center text-sm text-gray-500">
            <p>
              By logging in, you agree to connect to the Mycelium P2P network
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-2">
            <p><strong>Security:</strong> All messages are end-to-end encrypted</p>
            <p><strong>Privacy:</strong> No central servers store your data</p>
            <p><strong>Decentralized:</strong> Direct P2P communication</p>
          </div>
        </div>
      </div>
    </div>
  );
};
