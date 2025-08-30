// User discovery service using Mycelium topics
import { v4 as uuid } from 'uuid';
import type { 
  MyceliumChatProfile, 
  UserAnnouncement, 
  DiscoveryQuery, 
  DiscoveryResponse,
  TFConnectProfile 
} from '../types';
import { MyceliumAPI } from './mycelium';
import { TFConnectAuth } from './tfconnect';

export class UserDiscoveryService {
  private myceliumAPI: MyceliumAPI;
  private tfConnectAuth: TFConnectAuth;
  private currentProfile: MyceliumChatProfile | null = null;
  private discoveredUsers = new Map<string, MyceliumChatProfile>();
  private announcementInterval: NodeJS.Timeout | null = null;
  private directoryTopic = 'mycelium-chat.directory';

  constructor() {
    this.myceliumAPI = new MyceliumAPI();
    this.tfConnectAuth = new TFConnectAuth();
  }

  /**
   * Initialize discovery service with user profile
   */
  async initialize(tfProfile: TFConnectProfile): Promise<void> {
    this.currentProfile = this.tfConnectAuth.createMyceliumProfile(tfProfile);
    
    // Store profile locally
    localStorage.setItem('mycelium_chat_profile', JSON.stringify(this.currentProfile));
    
    // Publish profile to network
    await this.publishProfile();
    
    // Start periodic announcements
    this.startPeriodicAnnouncements();
    
    // Start listening for directory messages
    this.startDirectoryListener();
  }

  /**
   * Publish user profile to directory
   */
  async publishProfile(): Promise<void> {
    if (!this.currentProfile) return;

    const announcement: UserAnnouncement = {
      type: 'user_announcement',
      version: '1.0',
      profile: {
        ...this.currentProfile,
        lastSeen: Date.now()
      },
      timestamp: Date.now(),
      signature: await this.tfConnectAuth.sign(JSON.stringify(this.currentProfile)),
      ttl: 300 // 5 minutes
    };

    const topics = this.getPublishTopics(this.currentProfile.visibility);
    
    for (const topic of topics) {
      const result = await this.myceliumAPI.sendMessage(
        'broadcast',
        JSON.stringify(announcement),
        topic
      );
      
      if (!result.success) {
        console.warn(`Failed to publish to topic ${topic}:`, result.error);
      }
    }
  }

  /**
   * Discover users with optional filters
   */
  async discoverUsers(filters?: {
    groups?: string[];
    search?: string;
    status?: string[];
  }): Promise<MyceliumChatProfile[]> {
    const query: DiscoveryQuery = {
      type: 'discovery_query',
      filters: filters || {},
      requestId: uuid(),
      requester: this.currentProfile?.myceliumAddress || ''
    };

    // Send query to discovery topics
    const topics = this.getDiscoveryTopics(filters);
    
    for (const topic of topics) {
      await this.myceliumAPI.sendMessage(
        'broadcast',
        JSON.stringify(query),
        topic
      );
    }

    // Wait for responses and return discovered users
    return this.collectDiscoveryResponses(query.requestId);
  }

  /**
   * Get list of discovered users
   */
  getDiscoveredUsers(): MyceliumChatProfile[] {
    return Array.from(this.discoveredUsers.values());
  }

  /**
   * Update user status
   */
  async updateStatus(status: 'online' | 'away' | 'offline' | 'dnd'): Promise<void> {
    if (!this.currentProfile) return;
    
    this.currentProfile.status = status;
    this.currentProfile.lastSeen = Date.now();
    
    // Update stored profile
    localStorage.setItem('mycelium_chat_profile', JSON.stringify(this.currentProfile));
    
    // Publish updated profile
    await this.publishProfile();
  }

  /**
   * Stop discovery service
   */
  stop(): void {
    if (this.announcementInterval) {
      clearInterval(this.announcementInterval);
      this.announcementInterval = null;
    }
  }

  private getPublishTopics(visibility: string): string[] {
    const topics = [];
    
    switch (visibility) {
      case 'public':
        topics.push(`${this.directoryTopic}.global`);
        break;
      case 'groups':
        if (this.currentProfile?.groups) {
          for (const group of this.currentProfile.groups) {
            topics.push(`${this.directoryTopic}.group.${group}`);
          }
        }
        break;
      case 'friends':
        // For friends-only, we don't publish to directory
        break;
      case 'private':
        // Private users don't announce
        break;
    }
    
    return topics;
  }

  private getDiscoveryTopics(filters?: any): string[] {
    const topics = [`${this.directoryTopic}.global`];
    
    if (filters?.groups) {
      for (const group of filters.groups) {
        topics.push(`${this.directoryTopic}.group.${group}`);
      }
    }
    
    return topics;
  }

  private startPeriodicAnnouncements(): void {
    // Re-announce every 5 minutes to maintain presence
    this.announcementInterval = setInterval(() => {
      this.publishProfile();
    }, 5 * 60 * 1000);
  }

  private async startDirectoryListener(): Promise<void> {
    // Listen for directory messages in the background
    const listenForMessages = async () => {
      try {
        const messages = await this.myceliumAPI.receiveMessages(30, this.directoryTopic);
        
        for (const message of messages) {
          await this.handleDirectoryMessage(message);
        }
      } catch (error) {
        console.warn('Error listening for directory messages:', error);
      }
      
      // Continue listening
      setTimeout(listenForMessages, 1000);
    };
    
    listenForMessages();
  }

  private async handleDirectoryMessage(message: any): Promise<void> {
    try {
      const payload = JSON.parse(atob(message.payload));
      
      switch (payload.type) {
        case 'user_announcement':
          await this.handleUserAnnouncement(payload as UserAnnouncement);
          break;
        case 'discovery_query':
          await this.handleDiscoveryQuery(payload as DiscoveryQuery, message.srcIp);
          break;
        case 'discovery_response':
          await this.handleDiscoveryResponse(payload as DiscoveryResponse);
          break;
      }
    } catch (error) {
      console.warn('Failed to handle directory message:', error);
    }
  }

  private async handleUserAnnouncement(announcement: UserAnnouncement): Promise<void> {
    // Skip our own announcements
    if (announcement.profile.tfConnectId === this.currentProfile?.tfConnectId) {
      return;
    }

    // Verify signature
    const isValid = await this.tfConnectAuth.verify(
      JSON.stringify(announcement.profile),
      announcement.signature,
      announcement.profile.publicKey
    );

    if (!isValid) {
      console.warn('Invalid signature for user announcement');
      return;
    }

    // Check if user should be visible
    if (!this.shouldShowUser(announcement.profile)) {
      return;
    }

    // Update discovered users cache
    this.discoveredUsers.set(announcement.profile.tfConnectId, announcement.profile);

    // Emit event for UI updates
    window.dispatchEvent(new CustomEvent('user_discovered', {
      detail: announcement.profile
    }));
  }

  private async handleDiscoveryQuery(query: DiscoveryQuery, requesterIp: string): Promise<void> {
    if (!this.currentProfile) return;

    // Check if we should respond to this query
    if (!this.shouldRespondToQuery(query)) return;

    const response: DiscoveryResponse = {
      type: 'discovery_response',
      requestId: query.requestId,
      profiles: [this.currentProfile],
      timestamp: Date.now()
    };

    // Send response directly to requester
    await this.myceliumAPI.sendMessage(
      query.requester,
      JSON.stringify(response)
    );
  }

  private async handleDiscoveryResponse(response: DiscoveryResponse): Promise<void> {
    for (const profile of response.profiles) {
      if (profile.tfConnectId !== this.currentProfile?.tfConnectId) {
        this.discoveredUsers.set(profile.tfConnectId, profile);
        
        window.dispatchEvent(new CustomEvent('user_discovered', {
          detail: profile
        }));
      }
    }
  }

  private shouldShowUser(profile: MyceliumChatProfile): boolean {
    if (!this.currentProfile) return false;

    switch (profile.visibility) {
      case 'public':
        return true;
      case 'groups':
        return profile.groups.some(group => 
          this.currentProfile?.groups.includes(group)
        );
      case 'friends':
        // Would need to check friend relationships
        return false;
      case 'private':
        return false;
      default:
        return false;
    }
  }

  private shouldRespondToQuery(query: DiscoveryQuery): boolean {
    if (!this.currentProfile) return false;

    // Check visibility settings
    if (this.currentProfile.visibility === 'private') return false;

    // Check group filters
    if (query.filters.groups && this.currentProfile.visibility === 'groups') {
      return query.filters.groups.some(group => 
        this.currentProfile?.groups.includes(group)
      );
    }

    // Check status filters
    if (query.filters.status && !query.filters.status.includes(this.currentProfile.status)) {
      return false;
    }

    // Check search filter
    if (query.filters.search) {
      const searchTerm = query.filters.search.toLowerCase();
      return this.currentProfile.displayName.toLowerCase().includes(searchTerm);
    }

    return true;
  }

  private async collectDiscoveryResponses(requestId: string): Promise<MyceliumChatProfile[]> {
    return new Promise((resolve) => {
      const responses: MyceliumChatProfile[] = [];
      const timeout = setTimeout(() => {
        resolve(responses);
      }, 5000); // Wait 5 seconds for responses

      const handleResponse = (event: CustomEvent) => {
        if (event.detail.requestId === requestId) {
          responses.push(...event.detail.profiles);
        }
      };

      window.addEventListener('discovery_response', handleResponse as EventListener);
      
      setTimeout(() => {
        window.removeEventListener('discovery_response', handleResponse as EventListener);
        clearTimeout(timeout);
        resolve(responses);
      }, 5000);
    });
  }
}
