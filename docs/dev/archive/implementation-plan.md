# Implementation Plan

## Technical Specifications

### Phase 1: Web MVP Implementation

#### Project Setup
```bash
# Initialize React project with Vite
npm create vite@latest mycelium-chat-web -- --template react-ts
cd mycelium-chat-web
npm install

# Install core dependencies
npm install @chatscope/chat-ui-kit-react @chatscope/chat-ui-kit-styles
npm install axios uuid
npm install @types/uuid

# Install development dependencies
npm install -D tailwindcss postcss autoprefixer
npm install -D eslint prettier
```

#### Directory Structure
```
mycelium-chat/
├── web/                    # Static web application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── Chat/       # Chat interface components
│   │   │   ├── Auth/       # Authentication components
│   │   │   ├── Contacts/   # Contact management
│   │   │   └── Common/     # Shared components
│   │   ├── services/       # API and service layers
│   │   │   ├── mycelium.ts # Mycelium API client
│   │   │   ├── tfconnect.ts # ThreeFold Connect integration
│   │   │   └── discovery.ts # User discovery service
│   │   ├── types/          # TypeScript type definitions
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Utility functions
│   │   └── App.tsx         # Main application component
│   ├── public/             # Static assets
│   └── dist/               # Built static files
├── docs/                   # Documentation
├── scripts/                # Build and deployment scripts
└── README.md
```

#### Core Components Implementation

**MyceliumAPI Service**
```typescript
// src/services/mycelium.ts
export class MyceliumAPI {
  private baseURL = 'http://localhost:8989/api/v1';
  
  async sendMessage(recipient: string, message: string, topic?: string) {
    return fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dst: { pk: recipient },
        payload: btoa(message),
        topic: topic ? btoa(topic) : undefined
      })
    });
  }
  
  async receiveMessages(timeout = 30, topic?: string) {
    const params = new URLSearchParams({
      timeout: timeout.toString(),
      ...(topic && { topic: btoa(topic) })
    });
    
    return fetch(`${this.baseURL}/messages?${params}`);
  }
  
  async getNodeInfo() {
    return fetch(`${this.baseURL}/admin`);
  }
}
```

**ThreeFold Connect Integration**
```typescript
// src/services/tfconnect.ts
export class TFConnectAuth {
  private clientId = 'mycelium-chat';
  private redirectUri = window.location.origin + '/auth/callback';
  
  async login() {
    const authUrl = `https://login.threefold.me/?` +
      `appid=${this.clientId}&` +
      `redirecturl=${encodeURIComponent(this.redirectUri)}&` +
      `scope=${encodeURIComponent('{"user": true, "email": true}')}`;
    
    window.location.href = authUrl;
  }
  
  async handleCallback(code: string) {
    // Process authentication callback
    // Return user profile and generate Mycelium identity
  }
}
```

**User Discovery System**
```typescript
// src/services/discovery.ts
export interface UserProfile {
  tfConnectId: string;
  myceliumAddress: string;
  displayName: string;
  visibility: 'public' | 'friends' | 'groups' | 'private';
  groups: string[];
  lastSeen: number;
  status: 'online' | 'away' | 'offline';
}

export class UserDiscovery {
  private myceliumAPI: MyceliumAPI;
  private directoryTopic = 'mycelium-chat.directory';
  
  async publishProfile(profile: UserProfile) {
    return this.myceliumAPI.sendMessage(
      'broadcast',
      JSON.stringify(profile),
      this.directoryTopic
    );
  }
  
  async discoverUsers(filter?: string): Promise<UserProfile[]> {
    // Listen for directory announcements
    // Filter and return matching users
  }
}
```

#### UI Component Integration

**Main Chat Interface**
```typescript
// src/components/Chat/ChatContainer.tsx
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput
} from '@chatscope/chat-ui-kit-react';

export const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [currentContact, setCurrentContact] = useState(null);
  
  const handleSendMessage = async (text: string) => {
    if (!currentContact) return;
    
    await myceliumAPI.sendMessage(
      currentContact.myceliumAddress,
      text,
      `chat.direct.${currentContact.tfConnectId}`
    );
    
    // Add to local message list
    setMessages(prev => [...prev, {
      id: uuid(),
      message: text,
      sentTime: new Date().toISOString(),
      sender: 'You',
      direction: 'outgoing'
    }]);
  };
  
  return (
    <MainContainer>
      <ChatContainer>
        <MessageList>
          {messages.map(msg => (
            <Message key={msg.id} model={msg} />
          ))}
        </MessageList>
        <MessageInput 
          placeholder="Type message here"
          onSend={handleSendMessage}
        />
      </ChatContainer>
    </MainContainer>
  );
};
```

### Phase 2: Enhanced Features

#### Group Chat Implementation
```typescript
// Group chats using Mycelium topics
const groupTopic = `chat.group.${groupId}`;

// Send to group
await myceliumAPI.sendMessage('broadcast', message, groupTopic);

// Listen for group messages
const groupMessages = await myceliumAPI.receiveMessages(30, groupTopic);
```

#### File Sharing System
```typescript
// File sharing via chunked messages
export class FileSharing {
  async shareFile(file: File, recipient: string) {
    const chunks = this.chunkFile(file);
    const fileId = uuid();
    
    // Send file metadata
    await myceliumAPI.sendMessage(recipient, JSON.stringify({
      type: 'file_metadata',
      fileId,
      name: file.name,
      size: file.size,
      chunks: chunks.length
    }));
    
    // Send file chunks
    for (let i = 0; i < chunks.length; i++) {
      await myceliumAPI.sendMessage(recipient, JSON.stringify({
        type: 'file_chunk',
        fileId,
        chunkIndex: i,
        data: btoa(chunks[i])
      }));
    }
  }
}
```

### Phase 3: Native Integration

#### MyceliumFlut Plugin Structure
```
myceliumflut-plugin/
├── lib/
│   ├── chat_plugin.dart      # Main plugin interface
│   ├── widgets/              # Flutter UI widgets
│   └── services/             # Dart services
├── web/                      # Web assets (our React app)
└── pubspec.yaml              # Flutter dependencies
```

#### Desktop Application (Tauri)
```rust
// src-tauri/src/main.rs
use tauri::Manager;

#[tauri::command]
async fn start_mycelium() -> Result<(), String> {
    // Start embedded Mycelium daemon
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_mycelium])
        .setup(|app| {
            // Initialize Mycelium on app start
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Development Workflow

### Local Development Setup
1. **Install MyceliumFlut**: Download and run locally
2. **Clone Repository**: `git clone <repo-url>`
3. **Install Dependencies**: `npm install`
4. **Start Development Server**: `npm run dev`
5. **Test Mycelium Connection**: Verify localhost:8989 API access

### Testing Strategy
- **Unit Tests**: Jest for utility functions and services
- **Component Tests**: React Testing Library for UI components
- **Integration Tests**: Cypress for end-to-end user flows
- **P2P Tests**: Multi-instance testing with local Mycelium nodes

### Build and Deployment
```bash
# Build static files
npm run build

# Deploy to GitHub Pages
npm run deploy

# Create desktop app bundle
npm run build:desktop

# Generate mobile app
npm run build:mobile
```

### Quality Assurance
- **Code Review**: Required for all pull requests
- **Automated Testing**: CI/CD pipeline with GitHub Actions
- **Security Audits**: Regular dependency and code security scans
- **Performance Monitoring**: Bundle size and runtime performance tracking

## API Specifications

### Mycelium HTTP API Endpoints
```
GET  /api/v1/admin                    # Node information
GET  /api/v1/messages                 # Receive messages
POST /api/v1/messages                 # Send messages
POST /api/v1/messages/reply/{id}      # Reply to message
GET  /api/v1/messages/status/{id}     # Message status
GET  /api/v1/admin/peers              # Connected peers
```

### Message Format
```typescript
interface MyceliumMessage {
  id: string;                    # Message ID
  srcIp: string;                # Sender IP
  srcPk: string;                # Sender public key
  dstIp: string;                # Recipient IP
  dstPk: string;                # Recipient public key
  topic?: string;               # Optional topic (base64)
  payload: string;              # Message content (base64)
}
```

### User Directory Protocol
```typescript
interface DirectoryAnnouncement {
  type: 'user_announcement';
  profile: UserProfile;
  timestamp: number;
  signature: string;            # Cryptographic signature
}

interface DirectoryQuery {
  type: 'user_query';
  filters: {
    groups?: string[];
    status?: string;
    lastSeen?: number;
  };
}
```

## Security Considerations

### Authentication Security
- ThreeFold Connect OAuth with PKCE
- Secure token storage (localStorage with encryption)
- Session timeout and refresh mechanisms

### Message Security
- Mycelium provides transport encryption
- Optional application-layer encryption for sensitive data
- Message integrity verification

### Privacy Protection
- No message storage on central servers
- User-controlled visibility settings
- Minimal metadata collection

## Performance Optimization

### Frontend Optimization
- Code splitting and lazy loading
- Message virtualization for large chat histories
- Efficient state management with React Context/Redux
- Service worker for offline functionality

### Network Optimization
- Message batching for high-frequency updates
- Connection pooling and keep-alive
- Retry logic with exponential backoff
- Bandwidth-aware file sharing

## Monitoring and Analytics

### Application Metrics
- Message delivery success rates
- Connection establishment time
- User engagement metrics
- Error rates and crash reports

### Network Health
- Mycelium peer connectivity
- Message routing performance
- Network partition detection
- Bandwidth utilization

## Documentation Requirements

### User Documentation
- Installation and setup guides
- User interface tutorials
- Troubleshooting guides
- Privacy and security information

### Developer Documentation
- API reference documentation
- Plugin development guide
- Contribution guidelines
- Architecture deep-dive
