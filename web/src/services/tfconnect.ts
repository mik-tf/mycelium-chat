// ThreeFold Connect authentication service
import type { TFConnectProfile, MyceliumChatProfile } from '../types';

export class TFConnectAuth {
  private clientId = 'mycelium-chat';
  private redirectUri = window.location.origin + '/auth/callback';
  private baseUrl = 'https://login.threefold.me';

  /**
   * Initiate ThreeFold Connect login
   */
  async login(): Promise<void> {
    const state = this.generateState();
    localStorage.setItem('tf_connect_state', state);

    const authUrl = `${this.baseUrl}/?` +
      `appid=${encodeURIComponent(this.clientId)}&` +
      `redirecturl=${encodeURIComponent(this.redirectUri)}&` +
      `scope=${encodeURIComponent('{"user": true, "email": true}')}&` +
      `state=${encodeURIComponent(state)}`;

    window.location.href = authUrl;
  }

  /**
   * Handle authentication callback
   */
  async handleCallback(code: string, state: string): Promise<{
    success: boolean;
    profile?: TFConnectProfile;
    error?: string;
  }> {
    try {
      // Verify state parameter
      const storedState = localStorage.getItem('tf_connect_state');
      if (state !== storedState) {
        throw new Error('Invalid state parameter');
      }

      // Exchange code for profile (simplified - in real implementation would call TF Connect API)
      const profile = await this.exchangeCodeForProfile(code);
      
      // Store authentication data
      localStorage.setItem('tf_connect_profile', JSON.stringify(profile));
      localStorage.setItem('tf_connect_authenticated', 'true');
      localStorage.removeItem('tf_connect_state');

      return {
        success: true,
        profile
      };
    } catch (error) {
      console.error('Authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Get current authenticated user profile
   */
  getCurrentProfile(): TFConnectProfile | null {
    try {
      const profileData = localStorage.getItem('tf_connect_profile');
      if (!profileData) return null;

      return JSON.parse(profileData);
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return localStorage.getItem('tf_connect_authenticated') === 'true' && 
           this.getCurrentProfile() !== null;
  }

  /**
   * Logout user
   */
  logout(): void {
    localStorage.removeItem('tf_connect_profile');
    localStorage.removeItem('tf_connect_authenticated');
    localStorage.removeItem('mycelium_chat_profile');
  }

  /**
   * Generate Mycelium address from TF Connect public key
   */
  generateMyceliumAddress(publicKey: string): string {
    // Simplified address generation - in real implementation would use proper crypto
    const hash = this.simpleHash(publicKey + 'mycelium-chat-salt');
    return this.formatAsIPv6(hash.slice(0, 32));
  }

  /**
   * Create Mycelium Chat profile from TF Connect profile
   */
  createMyceliumProfile(tfProfile: TFConnectProfile): MyceliumChatProfile {
    return {
      tfConnectId: tfProfile.id,
      myceliumAddress: this.generateMyceliumAddress(tfProfile.publicKey),
      displayName: tfProfile.name,
      avatar: tfProfile.avatar,
      status: 'online',
      visibility: 'public',
      groups: [],
      lastSeen: Date.now(),
      publicKey: tfProfile.publicKey
    };
  }

  /**
   * Sign data with user's private key (placeholder)
   */
  async sign(data: string): Promise<string> {
    // In real implementation, this would use TF Connect's signing capabilities
    // For now, return a mock signature
    return btoa(`signature_${data}_${Date.now()}`);
  }

  /**
   * Verify signature (placeholder)
   */
  async verify(data: string, signature: string, publicKey: string): Promise<boolean> {
    // In real implementation, this would verify the cryptographic signature
    // For now, return true for mock signatures
    return signature.startsWith(btoa('signature_'));
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private async exchangeCodeForProfile(code: string): Promise<TFConnectProfile> {
    // In real implementation, this would call the TF Connect API
    // For development, return a mock profile
    return {
      id: `tf_${Date.now()}`,
      name: 'Demo User',
      email: 'demo@example.com',
      publicKey: `pk_${Math.random().toString(36).substring(2)}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`
    };
  }

  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private formatAsIPv6(hash: string): string {
    // Format hash as IPv6 address
    const groups = [];
    for (let i = 0; i < hash.length; i += 4) {
      groups.push(hash.slice(i, i + 4));
    }
    return `2001:db8::${groups.join(':')}`;
  }
}
