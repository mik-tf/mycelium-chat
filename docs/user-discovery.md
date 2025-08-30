# User Discovery System

## Overview

The Mycelium Chat user discovery system enables decentralized peer finding through ThreeFold Connect integration and Mycelium's topic-based messaging system. Users can control their visibility and discover others without relying on central servers.

## Architecture

```
ThreeFold Connect → User Identity → Mycelium Address → Directory Topic
                                                            ↓
User Profile → Encrypted Announcement → P2P Distribution → Discovery
```

## Identity Management

### ThreeFold Connect Integration

**Authentication Flow:**
1. User visits Mycelium Chat web app
2. Clicks "Login with ThreeFold Connect"
3. Redirected to `https://login.threefold.me/`
4. OAuth flow with scopes: `{user: true, email: true}`
5. Returns with user profile and cryptographic identity
6. Mycelium address derived from TF Connect public key

**User Profile Structure:**
```typescript
interface TFConnectProfile {
  id: string;                    # ThreeFold Connect ID
  name: string;                  # Display name
  email: string;                 # Email address
  publicKey: string;             # Cryptographic public key
  avatar?: string;               # Profile picture URL
}

interface MyceliumChatProfile {
  tfConnectId: string;           # TF Connect ID
  myceliumAddress: string;       # Derived Mycelium IPv6 address
  displayName: string;           # User's chosen display name
  avatar?: string;               # Profile picture
  status: UserStatus;            # Online/Away/Offline
  visibility: VisibilityLevel;   # Who can discover this user
  groups: string[];              # Group memberships
  lastSeen: number;              # Unix timestamp
  publicKey: string;             # For message verification
}
```

### Mycelium Address Generation

```typescript
// Generate deterministic Mycelium address from TF Connect identity
function generateMyceliumAddress(tfPublicKey: string): string {
  const hash = sha256(tfPublicKey + 'mycelium-chat-salt');
  const ipv6 = formatAsIPv6(hash.slice(0, 16));
  return ipv6;
}
```

## Discovery Protocol

### Directory Topic System

**Topic Structure:**
- `mycelium-chat.directory.global` - Global user announcements
- `mycelium-chat.directory.group.{groupId}` - Group-specific directories
- `mycelium-chat.directory.region.{region}` - Regional directories

### User Announcements

**Announcement Message:**
```typescript
interface UserAnnouncement {
  type: 'user_announcement';
  version: '1.0';
  profile: MyceliumChatProfile;
  timestamp: number;
  signature: string;             # Cryptographic signature
  ttl: number;                   # Time-to-live in seconds
}
```

**Publishing Process:**
1. User logs in and creates/updates profile
2. Profile signed with TF Connect private key
3. Announcement broadcast to appropriate directory topics
4. Periodic re-announcements to maintain presence

### Discovery Queries

**Query Message:**
```typescript
interface DiscoveryQuery {
  type: 'discovery_query';
  filters: {
    groups?: string[];           # Filter by group membership
    status?: UserStatus[];       # Filter by online status
    region?: string;             # Geographic filtering
    lastSeen?: number;           # Minimum last seen timestamp
    search?: string;             # Text search in display names
  };
  requestId: string;             # For matching responses
  requester: string;             # Requester's Mycelium address
}

interface DiscoveryResponse {
  type: 'discovery_response';
  requestId: string;             # Matching request ID
  profiles: MyceliumChatProfile[];
  timestamp: number;
}
```

## Visibility Controls

### Visibility Levels

**Public**
- Profile visible to all users
- Appears in global directory
- Can be discovered by anyone

**Groups**
- Only visible to members of shared groups
- Appears in group-specific directories
- Requires group membership verification

**Friends**
- Only visible to explicitly added contacts
- Uses direct profile sharing
- No directory announcements

**Private**
- Not discoverable through directory
- Direct address sharing required
- No automatic announcements

### Group Management

**Group Structure:**
```typescript
interface ChatGroup {
  id: string;                    # Unique group identifier
  name: string;                  # Group display name
  description?: string;          # Group description
  type: 'public' | 'private' | 'invite_only';
  members: GroupMember[];
  admins: string[];              # TF Connect IDs of admins
  created: number;               # Creation timestamp
  directoryTopic: string;        # Mycelium topic for group directory
}

interface GroupMember {
  tfConnectId: string;
  myceliumAddress: string;
  joinedAt: number;
  role: 'member' | 'admin' | 'moderator';
}
```

## Implementation Details

### Frontend Discovery Service

```typescript
export class UserDiscoveryService {
  private myceliumAPI: MyceliumAPI;
  private currentProfile: MyceliumChatProfile | null = null;
  private discoveredUsers = new Map<string, MyceliumChatProfile>();
  private announcementInterval: NodeJS.Timeout | null = null;

  async initialize(tfProfile: TFConnectProfile) {
    this.currentProfile = this.createMyceliumProfile(tfProfile);
    await this.publishProfile();
    this.startPeriodicAnnouncements();
  }

  async publishProfile() {
    if (!this.currentProfile) return;

    const announcement: UserAnnouncement = {
      type: 'user_announcement',
      version: '1.0',
      profile: this.currentProfile,
      timestamp: Date.now(),
      signature: await this.signProfile(this.currentProfile),
      ttl: 300 // 5 minutes
    };

    // Publish to appropriate topics based on visibility
    const topics = this.getPublishTopics(this.currentProfile.visibility);
    for (const topic of topics) {
      await this.myceliumAPI.sendMessage(
        'broadcast',
        JSON.stringify(announcement),
        topic
      );
    }
  }

  async discoverUsers(filters?: DiscoveryFilters): Promise<MyceliumChatProfile[]> {
    const query: DiscoveryQuery = {
      type: 'discovery_query',
      filters: filters || {},
      requestId: uuid(),
      requester: this.currentProfile?.myceliumAddress || ''
    };

    // Send query to directory topics
    const topics = this.getDiscoveryTopics(filters);
    for (const topic of topics) {
      await this.myceliumAPI.sendMessage(
        'broadcast',
        JSON.stringify(query),
        topic
      );
    }

    // Listen for responses
    return this.collectDiscoveryResponses(query.requestId);
  }

  private startPeriodicAnnouncements() {
    // Re-announce every 5 minutes to maintain presence
    this.announcementInterval = setInterval(() => {
      this.publishProfile();
    }, 5 * 60 * 1000);
  }
}
```

### Message Handling

```typescript
// Handle incoming directory messages
async function handleDirectoryMessage(message: MyceliumMessage) {
  const payload = JSON.parse(atob(message.payload));
  
  switch (payload.type) {
    case 'user_announcement':
      await handleUserAnnouncement(payload as UserAnnouncement);
      break;
      
    case 'discovery_query':
      await handleDiscoveryQuery(payload as DiscoveryQuery, message.srcIp);
      break;
      
    case 'discovery_response':
      await handleDiscoveryResponse(payload as DiscoveryResponse);
      break;
  }
}

async function handleUserAnnouncement(announcement: UserAnnouncement) {
  // Verify signature
  const isValid = await verifyProfileSignature(
    announcement.profile,
    announcement.signature
  );
  
  if (!isValid) return;
  
  // Check if user should be visible to current user
  if (!shouldShowUser(announcement.profile)) return;
  
  // Update local user cache
  discoveredUsers.set(announcement.profile.tfConnectId, announcement.profile);
  
  // Notify UI of new/updated user
  eventBus.emit('user_discovered', announcement.profile);
}
```

## Privacy and Security

### Cryptographic Verification

**Profile Signing:**
```typescript
async function signProfile(profile: MyceliumChatProfile): Promise<string> {
  const profileData = JSON.stringify({
    tfConnectId: profile.tfConnectId,
    myceliumAddress: profile.myceliumAddress,
    displayName: profile.displayName,
    timestamp: profile.lastSeen
  });
  
  return await tfConnect.sign(profileData);
}

async function verifyProfileSignature(
  profile: MyceliumChatProfile,
  signature: string
): Promise<boolean> {
  const profileData = JSON.stringify({
    tfConnectId: profile.tfConnectId,
    myceliumAddress: profile.myceliumAddress,
    displayName: profile.displayName,
    timestamp: profile.lastSeen
  });
  
  return await tfConnect.verify(profileData, signature, profile.publicKey);
}
```

### Privacy Protection

**Data Minimization:**
- Only essential profile data shared
- No message content in directory
- Optional fields can be omitted

**Selective Visibility:**
- Users control who can discover them
- Group-based filtering
- Geographic scoping options

**Anti-Spam Measures:**
- Rate limiting on announcements
- Signature verification required
- TTL-based cache expiration

## Scalability Considerations

### Topic Sharding

For large user bases, implement hierarchical topic structure:
```
mycelium-chat.directory.global.shard.{0-255}
mycelium-chat.directory.region.{region}.shard.{0-15}
mycelium-chat.directory.group.{groupId}
```

### Caching Strategy

**Local Cache:**
- Store discovered users in IndexedDB
- Cache TTL based on last seen timestamp
- Periodic cleanup of stale entries

**Distributed Cache:**
- Popular users cached by multiple nodes
- Regional caching for geographic optimization
- Group member caching for faster lookups

### Performance Optimization

**Lazy Discovery:**
- Only query when user actively searches
- Background refresh for active contacts
- Pagination for large result sets

**Network Efficiency:**
- Batch multiple queries
- Compress announcement payloads
- Use bloom filters for efficient filtering

## User Experience

### Contact Management

**Adding Contacts:**
1. User searches in discovery interface
2. Selects user from results
3. Sends contact request (optional)
4. Direct messaging enabled

**Contact States:**
- `discovered` - Found through directory
- `requested` - Contact request sent
- `accepted` - Mutual contact relationship
- `blocked` - User blocked

### Status Indicators

**Presence Status:**
- 🟢 Online - Active in last 5 minutes
- 🟡 Away - Active in last hour
- ⚫ Offline - Not seen recently
- 🔴 Do Not Disturb - Explicit status

**Discovery Indicators:**
- 🌐 Public - Discoverable by all
- 👥 Groups - Discoverable by group members
- 👤 Friends - Only visible to contacts
- 🔒 Private - Not discoverable

## Error Handling

### Network Issues
- Retry failed announcements
- Graceful degradation when Mycelium unavailable
- Offline mode with cached contacts

### Authentication Failures
- Handle TF Connect service outages
- Token refresh mechanisms
- Fallback authentication methods

### Discovery Failures
- Timeout handling for queries
- Partial result handling
- User feedback for failed searches
