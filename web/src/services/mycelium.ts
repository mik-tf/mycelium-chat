// Mycelium HTTP API client service
import axios from 'axios';
import type { MyceliumMessage } from '../types';

export class MyceliumAPI {
  private baseURL = 'http://localhost:8989/api/v1';
  private client = axios.create({
    baseURL: this.baseURL,
    timeout: 30000,
  });

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
      console.error('Failed to get node info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Mycelium not available'
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
    const info = await this.getNodeInfo();
    return info.success;
  }
}
