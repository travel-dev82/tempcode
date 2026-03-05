'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageCircle, Wifi, WifiOff } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { formatRelativeTime } from '@/utils/chatUtils';
import PubSubClient from '@/utils/pubsubClient';

// Components
import ConversationList from './components/refactored/ConversationList';
import ChatHeader from './components/refactored/ChatHeader';
import MessageList from './components/refactored/MessageList';
import MessageInput from './components/refactored/MessageInput';

// Default example values for personalization tags
const DEFAULT_TAG_EXAMPLES = {
  'first_name': 'John',
  'last_name': 'Doe',
  'birthday_date': 'Jan 15',
  'anniversary_date': 'Jun 20',
  'address': '123 Main St',
  'value1': 'Value 1',
  'value2': 'Value 2',
  'value3': 'Value 3',
  'value4': 'Value 4',
  'value5': 'Value 5',
};

export default function ChatPage() {
  // ─── State ─────────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pubsubConnected, setPubsubConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Pagination
  const [conversationsPage, setConversationsPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  
  // Refs
  const userId = useRef(null);
  const pubsubRef = useRef(null);
  const sentMessagesTracker = useRef(new Set());
  const pendingSentMessages = useRef(new Map());
  const messageProcessingLock = useRef(new Set());
  const processedConversationUpdates = useRef(new Set());
  
  // ─── Initialize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const initialize = async () => {
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          userId.current = user.id;
          initializePubSub();
          await loadConversations();
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
      } finally {
        setLoading(false);
      }
    };
    
    initialize();
    
    return () => {
      pubsubRef.current?.disconnect();
    };
  }, []);
  
  // ─── Pub/Sub Setup ──────────────────────────────────────────────────────
  const initializePubSub = () => {
    if (!userId.current) return;
    
    try {
      pubsubRef.current = new PubSubClient({
        url: process.env.NEXT_PUBLIC_PUBSUB_URL || 'wss://pubsub-service.botmastersender.com'
      });
      
      pubsubRef.current.onMessage((payload) => {
        handlePubSubMessage(payload);
      });
      
      pubsubRef.current.connect();
      pubsubRef.current.subscribe(`conversations-${userId.current}`);
      
      // Monitor connection
      const checkConnection = setInterval(() => {
        if (pubsubRef.current) {
          setPubsubConnected(pubsubRef.current.isConnectionOpen());
        }
      }, 1000);
      
      return () => clearInterval(checkConnection);
    } catch (error) {
      console.error('Error initializing Pub/Sub:', error);
    }
  };
  
  // ─── Pub/Sub Message Handler ────────────────────────────────────────────
  const handlePubSubMessage = useCallback((data) => {
    if (!data.conversation || !data.messageRecord) return;
    
    const { conversation, messageRecord, direction } = data;
    const conversationId = conversation.id;
    
    // Build normalized message
    const normalizedMessage = {
      id: messageRecord.id,
      whatsapp_message_id: data.messageId,
      message_content: messageRecord.messageContent,
      message_type: messageRecord.messageType || data.type,
      direction: direction,
      timestamp: messageRecord.timestamp,
      status: 'delivered',
      from_phone: data.from,
      to_phone: data.to,
      media_url: data.content?.media?.url || null,
      media_mime_type: data.content?.media?.mimeType || null,
      media_filename: data.content?.media?.filename || null,
      media_caption: data.content?.media?.caption || null,
      location_data: data.content?.location || null,
      contact_data: data.content?.contacts || null
    };
    
    handleNewMessage(normalizedMessage, conversationId);
  }, []);
  
  // ─── New Message Handler ────────────────────────────────────────────────
  const handleNewMessage = useCallback((message, conversationId) => {
    if (!message || !conversationId) return;
    
    const messageId = message.whatsapp_message_id || message.uid || `${Date.now()}`;
    const processingKey = `${conversationId}_${messageId}`;
    
    // Prevent duplicate processing
    if (messageProcessingLock.current.has(processingKey)) return;
    messageProcessingLock.current.add(processingKey);
    setTimeout(() => messageProcessingLock.current.delete(processingKey), 2000);
    
    // Update conversation list
    const updateKey = `conversation_${conversationId}_${messageId}`;
    if (!processedConversationUpdates.current.has(updateKey)) {
      processedConversationUpdates.current.add(updateKey);
      setTimeout(() => processedConversationUpdates.current.delete(updateKey), 10000);
      
      setConversations(prev => {
        const updated = prev.map(conv => {
          if (conv.id === conversationId) {
            let lastContent = message.message_content;
            if (!lastContent) {
              const typeMap = {
                image: '📷 Image', video: '🎥 Video', audio: '🎵 Audio',
                document: '📄 Document', location: '📍 Location', contact: '👤 Contact'
              };
              lastContent = typeMap[message.message_type] || 'New message';
            }
            
            return {
              ...conv,
              last_message_content: lastContent,
              last_message_type: message.message_type || 'text',
              last_message_at: message.timestamp,
              last_message_direction: message.direction,
              unread_count: message.direction === 'inbound' ? conv.unread_count + 1 : conv.unread_count,
              last_message_time_ago: 'Just now'
            };
          }
          return conv;
        });
        
        // Move to top
        const conv = updated.find(c => c.id === conversationId);
        const others = updated.filter(c => c.id !== conversationId);
        return conv ? [conv, ...others] : updated;
      });
    }
    
    // Add to messages if conversation is selected
    if (selectedConversation?.id === conversationId) {
      setMessages(prev => {
        // Deduplication
        if (prev.some(m => m.whatsapp_message_id === message.whatsapp_message_id || m.uid === message.uid)) {
          return prev;
        }
        return [...prev, message];
      });
      
      if (message.direction === 'inbound') {
        markAsRead(conversationId);
      }
    }
  }, [selectedConversation]);
  
  // ─── API Functions ──────────────────────────────────────────────────────
  const loadConversations = async (search = '', resetPage = true) => {
    try {
      const page = resetPage ? 1 : conversationsPage;
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.append('search', search);
      
      const response = await axiosInstance.get(`/api/conversations?${params}`);
      
      if (response.data.success) {
        setConversations(response.data.data.conversations);
        setHasMoreConversations(response.data.data.pagination.hasNextPage);
        if (resetPage) setConversationsPage(1);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };
  
  const loadMoreConversations = async () => {
    if (loadingMore || !hasMoreConversations) return;
    
    setLoadingMore(true);
    try {
      const nextPage = conversationsPage + 1;
      const params = new URLSearchParams({ page: nextPage, limit: 20 });
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await axiosInstance.get(`/api/conversations?${params}`);
      
      if (response.data.success) {
        const existingIds = new Set(conversations.map(c => c.id));
        const newConvs = response.data.data.conversations.filter(c => !existingIds.has(c.id));
        
        setConversations(prev => [...prev, ...newConvs]);
        setHasMoreConversations(response.data.data.pagination.hasNextPage);
        setConversationsPage(nextPage);
      }
    } catch (error) {
      console.error('Error loading more conversations:', error);
    } finally {
      setLoadingMore(false);
    }
  };
  
  const loadMessages = async (conversationId) => {
    setLoadingMessages(true);
    sentMessagesTracker.current.clear();
    pendingSentMessages.current.clear();
    messageProcessingLock.current.clear();
    
    try {
      const response = await axiosInstance.get(`/api/conversations/${conversationId}`);
      
      if (response.data.success) {
        setMessages(response.data.data.messages);
        if (response.data.data.conversation) {
          setSelectedConversation(response.data.data.conversation);
        }
        markAsRead(conversationId);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };
  
  const markAsRead = async (conversationId) => {
    try {
      await axiosInstance.post(`/api/conversations/${conversationId}/read`);
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };
  
  // ─── Send Message ───────────────────────────────────────────────────────
  const handleSendMessage = async (messageData) => {
    if (!selectedConversation || (!messageData.text?.trim() && !messageData.attachments?.length)) return;
    
    const hasText = messageData.text?.trim();
    const hasAttachments = messageData.attachments?.length > 0;
    
    // Create temp message
    const tempMessage = {
      uid: `temp-${Date.now()}`,
      whatsapp_message_id: `temp-${Date.now()}`,
      message_content: hasText ? messageData.text.trim() : '',
      direction: 'outbound',
      message_type: hasAttachments ? messageData.attachments[0].type : 'text',
      timestamp: new Date().toISOString(),
      status: 'pending',
      media_filename: hasAttachments ? messageData.attachments[0].file.name : null,
      media_caption: hasText ? messageData.text.trim() : null
    };
    
    // Track for deduplication
    const msgKey = `${tempMessage.message_content}_${Math.floor(Date.now() / 3000)}`;
    pendingSentMessages.current.set(msgKey, { tempUid: tempMessage.uid });
    
    // Add to UI
    setMessages(prev => [...prev, tempMessage]);
    
    try {
      let mediaUrl = null;
      
      // Upload media if needed
      if (hasAttachments) {
        const formData = new FormData();
        formData.append('files', messageData.attachments[0].file);
        
        const uploadRes = await axiosInstance.post('/api/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        });
        
        if (!uploadRes.data.success) throw new Error('Failed to upload media');
        mediaUrl = uploadRes.data.data[0].url;
      }
      
      // Send message
      const response = await axiosInstance.post(
        `/api/conversations/${selectedConversation.id}/messages`,
        {
          message_type: hasAttachments ? messageData.attachments[0].type : 'text',
          message_content: hasText ? messageData.text.trim() : '',
          ...(mediaUrl && { media_url: mediaUrl, media_caption: hasText ? messageData.text.trim() : null })
        },
        { timeout: 10000 }
      );
      
      if (response.data.success) {
        const realMessage = response.data.data.message;
        
        // Track sent message
        if (realMessage.whatsapp_message_id) {
          sentMessagesTracker.current.add(realMessage.whatsapp_message_id);
          setTimeout(() => sentMessagesTracker.current.delete(realMessage.whatsapp_message_id), 30000);
        }
        
        // Replace temp message
        setMessages(prev => prev.map(m => m.uid === tempMessage.uid ? realMessage : m));
        
        // Update conversation list
        setConversations(prev => {
          const updated = prev.map(conv => 
            conv.id === selectedConversation.id 
              ? { ...conv, last_message_content: hasText ? messageData.text.trim() : 'Attachment', last_message_at: new Date().toISOString(), last_message_direction: 'outbound', last_message_time_ago: 'Just now' }
              : conv
          );
          const conv = updated.find(c => c.id === selectedConversation.id);
          const others = updated.filter(c => c.id !== selectedConversation.id);
          return conv ? [conv, ...others] : updated;
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.uid !== tempMessage.uid));
      alert(`Failed to send: ${error.response?.data?.message || error.message}`);
    }
  };
  
  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleSelectConversation = useCallback((conversation) => {
    setSelectedConversation(conversation);
    setSidebarOpen(false);
    loadMessages(conversation.id);
  }, []);
  
  const handleBack = useCallback(() => {
    setSelectedConversation(null);
    setMessages([]);
    setSidebarOpen(true);
  }, []);
  
  // ─── Search Effect ──────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      loadConversations(searchTerm, true);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  // ─── Time Update Effect ─────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setConversations(prev => prev.map(conv => ({
        ...conv,
        last_message_time_ago: conv.last_message_at ? formatRelativeTime(conv.last_message_at) : ''
      })));
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  
  // ─── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#111B21] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-[#00A884] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#8696A0] text-sm">Loading chats...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#111B21] flex flex-col">
      {/* Top bar */}
      <div className="bg-[#00A884] h-28 flex-shrink-0" />
      
      {/* Main chat area */}
      <div className="flex-1 -mt-20 px-4 pb-4">
        <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex bg-white rounded-lg overflow-hidden shadow-2xl">
          
          {/* Sidebar - Conversation List */}
          <div className={`
            ${sidebarOpen || !selectedConversation ? 'flex' : 'hidden'}
            lg:flex flex-col w-full lg:w-[400px] lg:max-w-[400px] border-r border-[#E9EDEF] flex-shrink-0
          `}>
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#F0F2F5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D1D7DB] flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-[#54656F]" />
                </div>
                <h1 className="font-semibold text-[#111B21]">WhatsApp</h1>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${pubsubConnected ? 'bg-[#00A884]' : 'bg-[#8696A0]'}`} />
              </div>
            </div>
            
            {/* Conversation list */}
            <ConversationList
              conversations={conversations}
              selectedConversation={selectedConversation}
              onSelectConversation={handleSelectConversation}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMoreConversations}
              onLoadMore={loadMoreConversations}
            />
          </div>
          
          {/* Chat Window */}
          <div className={`
            ${!sidebarOpen || selectedConversation ? 'flex' : 'hidden'}
            lg:flex flex-col flex-1 min-w-0
          `}>
            {selectedConversation ? (
              <>
                <ChatHeader 
                  conversation={selectedConversation}
                  onBack={handleBack}
                  connected={pubsubConnected}
                  showBackButton={true}
                />
                
                <MessageList
                  messages={messages}
                  loading={loadingMessages}
                  loadingMore={false}
                  selectedConversation={selectedConversation}
                  scrollToBottom={true}
                />
                
                <MessageInput 
                  onSendMessage={handleSendMessage}
                  disabled={!pubsubConnected}
                  placeholder="Type a message..."
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-[#F0F2F5]">
                <div className="text-center max-w-sm px-4">
                  <div className="w-48 h-48 mx-auto mb-6">
                    <svg viewBox="0 0 303 172" className="w-full h-full text-[#8696A0] opacity-50">
                      <path fill="currentColor" d="M229.565 160.229c32.647-16.352 54.76-48.605 57.629-86.194-.239-3.473-.538-6.937-.896-10.384-4.165-40.048-27.452-74.549-61.091-92.639C204.727-18.477 180.567-24 155.166-24c-31.68 0-60.928 9.608-85.19 26.145-22.514 15.353-39.941 37.311-49.367 62.829-2.694 7.288-4.65 14.8-5.824 22.44-.577 3.757-.984 7.542-1.219 11.34-.131 2.115-.197 4.239-.197 6.372 0 5.486.507 10.889 1.483 16.166 2.313 12.511 7.115 24.4 14.073 34.916-4.075 7.788-9.548 14.521-16.024 20.107-3.285 2.833-4.138 7.606-2.043 11.384 2.095 3.777 6.47 5.494 10.569 4.142 12.402-4.093 23.939-10.256 34.061-18.181 18.979 12.483 41.575 19.675 65.85 19.675 13.395 0 26.382-2.148 38.673-6.168 1.487.839 3.004 1.64 4.55 2.403z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-light text-[#41525D] mb-3">
                    WhatsApp Web
                  </h2>
                  <p className="text-[#667781] text-sm leading-relaxed">
                    Send and receive messages without keeping your phone online.
                    Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
