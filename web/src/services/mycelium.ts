// Mycelium HTTP API client service
import axios from 'axios';
import type { MyceliumMessage } from '../types';

export class MyceliumAPI {
  private baseURL = 'http://localhost:8989/api/v1';
  private client = axios.create({
    baseURL: this.baseURL,
    timeout: 5000, // Shorter timeout for connection detection
  });
  private isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  private corsBlocked = false;

  /**
   * Send a message to a specific recipient or broadcast
   */
  async sendMessage(
    recipient: string, 
    message: string, 
    topic?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const payload = {
        dst: recipient === 'broadcast' ? undefined : { pk: recipient },
        payload: btoa(message),
        topic: topic ? btoa(topic) : undefined
      };

      const response = await this.client.post('/messages', payload);
      
      return {
        success: true,
        messageId: response.data?.id
      };
    } catch (error) {
      console.error('Failed to send message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Receive messages with optional timeout and topic filter
   */
  async receiveMessages(
    timeout = 30, 
    topic?: string
  ): Promise<MyceliumMessage[]> {
    try {
      const params = new URLSearchParams({
        timeout: timeout.toString(),
        ...(topic && { topic: btoa(topic) })
      });

      const response = await this.client.get(`/messages?${params}`);
      
      // Process received messages
      const messages = Array.isArray(response.data) ? response.data : [response.data];
      
      return messages.map((msg: any) => ({
        id: msg.id || Date.now().toString(),
        srcIp: msg.srcIp || '',
        srcPk: msg.srcPk || '',
        dstIp: msg.dstIp || '',
        dstPk: msg.dstPk || '',
        topic: msg.topic,
        payload: msg.payload,
        timestamp: msg.timestamp || Date.now()
      }));
    } catch (error) {
      console.error('Failed to receive messages:', error);
      return [];
    }
  }

  /**
   * Get node information and status
   */
  async getNodeInfo(): Promise<{
    success: boolean;
    nodeId?: string;
    address?: string;
    peers?: number;
    error?: string;
  }> {
    try {
      const response = await this.client.get('/admin');
      
      return {
        success: true,
        nodeId: response.data?.nodeId,
        address: response.data?.address,
        peers: response.data?.peers?.length || 0
      };
    } catch (error) {
      // Check if this is a CORS error
      if (error instanceof Error && (error.message.includes('CORS') || error.message.includes('Network Error'))) {
        this.corsBlocked = true;
      }
      
      console.error('Failed to get node info:', error);
      return {
        success: false,
        error: this.corsBlocked ? 'CORS blocked - use localhost for Mycelium access' : 
               (error instanceof Error ? error.message : 'Mycelium not available')
      };
    }
  }

  /**
   * Reply to a specific message
   */
  async replyToMessage(
    messageId: string,
    reply: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.post(`/messages/reply/${messageId}`, {
        payload: btoa(reply)
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to reply to message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<{
    success: boolean;
    status?: 'pending' | 'sent' | 'delivered' | 'failed';
    error?: string;
  }> {
    try {
      const response = await this.client.get(`/messages/status/${messageId}`);
      
      return {
        success: true,
        status: response.data?.status || 'pending'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get connected peers
   */
  async getPeers(): Promise<{
    success: boolean;
    peers?: Array<{ id: string; address: string; connected: boolean }>;
    error?: string;
  }> {
    try {
      const response = await this.client.get('/admin/peers');
      
      return {
        success: true,
        peers: response.data || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if Mycelium daemon is available
   */
  async isAvailable(): Promise<boolean> {
    // If we're on a deployed site (not localhost), Mycelium won't be accessible due to CORS
    if (!this.isLocalhost) {
      console.warn('Mycelium API not accessible from deployed site due to CORS restrictions');
      return false;
    }
    
    const info = await this.getNodeInfo();
    return info.success;
  }
  
  /**
   * Get mock Mycelium address for development/demo purposes
   */
  getMockAddress(): string {
    // Generate a realistic-looking Mycelium address
    return '400:8f3b:7c2a:1d4e:9a6f:2b8c:5e1a:3f7d';
  }
  
  /**
   * Check if we're in a CORS-blocked environment
   */
  isCorsBlocked(): boolean {
    return !this.isLocalhost;
  }
}
