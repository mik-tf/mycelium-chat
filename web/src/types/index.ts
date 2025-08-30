// Core type definitions for Mycelium Chat

export interface TFConnectProfile {
  id: string;
  name: string;
  email: string;
  publicKey: string;
  avatar?: string;
}

export interface MyceliumChatProfile {
  tfConnectId: string;
  myceliumAddress: string;
  displayName: string;
  avatar?: string;
  status: UserStatus;
  visibility: VisibilityLevel;
  groups: string[];
  lastSeen: number;
  publicKey: string;
}

export type UserStatus = 'online' | 'away' | 'offline' | 'dnd';
export type VisibilityLevel = 'public' | 'groups' | 'friends' | 'private';

export interface MyceliumMessage {
  id: string;
  srcIp: string;
  srcPk: string;
  dstIp: string;
  dstPk: string;
  topic?: string;
  payload: string;
  timestamp?: number;
}

export interface ChatMessage {
  id: string;
  message: string;
  sentTime: string;
  sender: string;
  direction: 'incoming' | 'outgoing';
  status?: 'sending' | 'sent' | 'delivered' | 'failed';
}

export interface Contact {
  id: string;
  profile: MyceliumChatProfile;
  lastMessage?: ChatMessage;
  unreadCount: number;
}

export interface UserAnnouncement {
  type: 'user_announcement';
  version: '1.0';
  profile: MyceliumChatProfile;
  timestamp: number;
  signature: string;
  ttl: number;
}

export interface DiscoveryQuery {
  type: 'discovery_query';
  filters: {
    groups?: string[];
    status?: UserStatus[];
    region?: string;
    lastSeen?: number;
    search?: string;
  };
  requestId: string;
  requester: string;
}

export interface DiscoveryResponse {
  type: 'discovery_response';
  requestId: string;
  profiles: MyceliumChatProfile[];
  timestamp: number;
}
