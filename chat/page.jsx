'use client';

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { getSettings } from '@/lib/returnLocalStorageData';
import axiosInstance from '@/lib/axios';
import MessageComposer from './components/MessageComposer';
import { formatMessageTime, getMessagePreview, messageStatus, getContactDisplayName, formatRelativeTime } from '@/utils/chatUtils';
import PubSubClient from '@/utils/pubsubClient';
import { 
  MessageCircle, 
  Search, 
  Phone, 
  MoreVertical,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock
} from 'lucide-react';

// Memoized conversation item component to prevent unnecessary re-renders
const ConversationItem = memo(({ 
  conversation, 
  isSelected, 
  onSelect, 
  getLastMessagePreview 
}) => {
  return (
    <div
      onClick={onSelect}
      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
        isSelected ? 'bg-[#2A7B6E]/10 border-l-4 border-l-[#2A7B6E]' : ''
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 bg-[#2A7B6E] rounded-full flex items-center justify-center text-white font-medium flex-shrink-0">
          {conversation.display_name?.[0]?.toUpperCase() || conversation.contact_phone?.[0] || '?'}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900 truncate">
              {conversation.display_name || conversation.contact_phone}
            </p>
            <p className="text-xs text-gray-500 flex-shrink-0 ml-2">
              {conversation.last_message_time_ago}
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 flex-1 mr-2">
              {conversation.last_message_direction === 'outbound' && '✓ '}
              <span className="truncate inline-block max-w-full">
                {getLastMessagePreview(conversation)}
              </span>
            </p>
            
            {conversation.unread_count > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-[#2A7B6E] rounded-full flex-shrink-0">
                {conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.last_message_at === nextProps.conversation.last_message_at &&
    prevProps.conversation.unread_count === nextProps.conversation.unread_count &&
    prevProps.conversation.last_message_time_ago === nextProps.conversation.last_message_time_ago &&
    prevProps.isSelected === nextProps.isSelected
  );
});

export default function WhatsAppChatPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const selectedConversationRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [stats, setStats] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [pubsubConnected, setPubsubConnected] = useState(false);
  const [conversationUpdateTrigger, setConversationUpdateTrigger] = useState(0);
  const [expandedMedia, setExpandedMedia] = useState(null);
  
  // Pagination state for infinite scrolling
  const [conversationPage, setConversationPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const conversationsContainerRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);
  const observerRef = useRef(null);
  
  const messagesEndRef = useRef(null);
  const pubsubRef = useRef(null);
  const sentMessagesTracker = useRef(new Set()); // Track sent messages to prevent duplicates
  const pendingSentMessages = useRef(new Map()); // Track pending sent messages by content+timestamp
  const messageProcessingLock = useRef(new Set()); // Prevent concurrent processing of the same message
  
  // Update ref whenever selectedConversation changes
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);
  
  // Handle escape key for modal close
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && expandedMedia) {
        setExpandedMedia(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expandedMedia]);
  
  const userId = useRef(null);

  // Initialize user data and Pub/Sub
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          userId.current = user.id;
          
          // Initialize Pub/Sub
          initializePubSub();
          
          // Load initial data
          await Promise.all([
            loadConversations(),
            loadStats()
          ]);
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeChat();

    return () => {
      if (pubsubRef.current) {
        pubsubRef.current.disconnect();
      }
    };
  }, []);

  // Initialize Pub/Sub connection
  const initializePubSub = () => {
    if (!userId.current) return;

    try {
      // Initialize Pub/Sub client
      pubsubRef.current = new PubSubClient({
        url: process.env.NEXT_PUBLIC_PUBSUB_URL || 'wss://pubsub-service.botmastersender.com'
      });

      // Register message handler
      pubsubRef.current.onMessage((payload, fullMessage) => {
        try {
          console.log('📨 Pub/Sub message received:', payload);
          handlePubSubMessage(payload);
        } catch (error) {
          console.error('❌ Error handling Pub/Sub message:', error);
          console.error('💡 Payload that caused error:', JSON.stringify(payload, null, 2));
        }
      });

      // Connect to Pub/Sub
      pubsubRef.current.connect();

      // Subscribe to user-specific conversation channel
      const channel = `conversations-${userId.current}`;
      pubsubRef.current.subscribe(channel);

      // Monitor connection status
      const checkConnection = setInterval(() => {
        if (pubsubRef.current) {
          const wasConnected = pubsubConnected;
          const isNowConnected = pubsubRef.current.isConnectionOpen();
          
          if (wasConnected !== isNowConnected) {
            setPubsubConnected(isNowConnected);
            console.log(isNowConnected ? '✅ Pub/Sub connected' : '❌ Pub/Sub disconnected');
          }
        }
      }, 1000);

      console.log(`✅ Subscribed to Pub/Sub channel: ${channel}`);

      // Store interval for cleanup
      return () => clearInterval(checkConnection);
    } catch (error) {
      console.error('Error initializing Pub/Sub:', error);
    }
  };

  // Handle Pub/Sub messages
  const handlePubSubMessage = (data) => {
    // Pub/Sub payload structure:
    // {
    //   messageId: "wamid...",
    //   from: "917000782082",
    //   to: "916268662275",
    //   type: "text",
    //   direction: "inbound" | "outbound",
    //   content: { type: "text", text: "...", ... },
    //   contactName: "Devendar Singh Gohil",
    //   contactPhone: "917000782082",
    //   userId: 123,
    //   conversation: { id, unreadCount, totalMessages, lastMessageAt },
    //   messageRecord: { id, messageContent, messageType, timestamp },
    //   ...
    // }
    
    if (!data.conversation || !data.messageRecord) {
      console.warn('⚠️ Pub/Sub message missing conversation or messageRecord data:', data);
      return;
    }
    
    const conversationId = data.conversation.id;
    const messageRecord = data.messageRecord;
    const direction = data.direction;
    
    console.log(`📨 Processing ${direction} message for conversation ${conversationId}`);
    
    // Build normalized message object for handleNewMessage
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
      interactive_data: data.content?.interactive || null,
      location_data: data.content?.location || null,
      contact_data: data.content?.contacts || null
    };
    
    // Pass the normalized message to existing handler
    handleNewMessage(normalizedMessage, conversationId);
  };

  // Handle new incoming message
  const handleNewMessage = (message, conversationId) => {
    // Validate input parameters
    if (!message || !conversationId) {
      return;
    }
    
    // Handle nested message structure
    const actualMessage = (message && typeof message === 'object' && message.message) ? message.message : message;
    const topLevelMessage = message;
    
    // Additional safety checks
    if (!actualMessage || typeof actualMessage !== 'object') {
      return;
    }

    // Create unique message identifier for processing lock
    const messageId = actualMessage.whatsapp_message_id || actualMessage.uid || `${Date.now()}_${Math.random()}`;
    const processingKey = `${conversationId}_${messageId}`;
    
    // Prevent concurrent processing of the same message
    if (messageProcessingLock.current.has(processingKey)) {
      return;
    }
    
    // Add to processing lock immediately
    messageProcessingLock.current.add(processingKey);
    
    // Clean up processing lock after a short time
    setTimeout(() => {
      messageProcessingLock.current.delete(processingKey);
    }, 2000); // 2 second lock to prevent race conditions
    
    // Create a unique processing key to prevent duplicate conversation list updates only
    const conversationUpdateKey = `conversation_${conversationId}_${messageId}`;
    
    // Initialize tracking sets
    if (!window.processedConversationUpdates) {
      window.processedConversationUpdates = new Set();
    }
    
    const shouldUpdateConversationList = !window.processedConversationUpdates.has(conversationUpdateKey);
    
    if (shouldUpdateConversationList) {
      window.processedConversationUpdates.add(conversationUpdateKey);
      setTimeout(() => {
        window.processedConversationUpdates.delete(conversationUpdateKey);
      }, 10000); // Shorter cleanup for conversation updates
    }

    // Ensure message has all required fields for proper display
    const normalizedMessage = {
      // Use nested data if top-level data is empty, fallback to top-level if nested doesn't exist
      uid: actualMessage?.uid || topLevelMessage?.uid || actualMessage?.whatsapp_message_id || topLevelMessage?.whatsapp_message_id || `ws-${Date.now()}`,
      whatsapp_message_id: actualMessage?.whatsapp_message_id || topLevelMessage?.whatsapp_message_id || actualMessage?.uid || topLevelMessage?.uid,
      message_content: actualMessage?.message_content || topLevelMessage?.message_content || actualMessage?.text || topLevelMessage?.text || '',
      message_type: actualMessage?.message_type || topLevelMessage?.message_type || 'text',
      direction: actualMessage?.direction || topLevelMessage?.direction || 'inbound',
      timestamp: actualMessage?.timestamp || topLevelMessage?.timestamp || new Date().toISOString(),
      status: actualMessage?.status || topLevelMessage?.status || 'delivered',
      from_phone: actualMessage?.from_phone || topLevelMessage?.from_phone || '',
      to_phone: actualMessage?.to_phone || topLevelMessage?.to_phone || '',
      media_url: actualMessage?.media_url || topLevelMessage?.media_url || null,
      media_filename: actualMessage?.media_filename || topLevelMessage?.media_filename || null,
      media_caption: actualMessage?.media_caption || topLevelMessage?.media_caption || null,
      media_mime_type: actualMessage?.media_mime_type || topLevelMessage?.media_mime_type || null,
      // Include any additional fields from the actual message record (with safety check)
      ...(actualMessage && typeof actualMessage === 'object' ? actualMessage : {})
    };

    // Update conversation list with comprehensive last message info (only if not recently updated)
    if (shouldUpdateConversationList) {
      setConversations(prev => {
        const updatedConversations = prev.map(conv => {
          if (conv.id === conversationId) {
          
          // Get appropriate content based on message type
          let lastMessageContent = normalizedMessage.message_content;
          
          // For media messages without text content, use appropriate placeholders
          if (!lastMessageContent) {
            switch (normalizedMessage.message_type) {
              case 'image':
                lastMessageContent = normalizedMessage.media_caption || 'Image';
                break;
              case 'video':
                lastMessageContent = normalizedMessage.media_caption || 'Video';
                break;
              case 'audio':
                lastMessageContent = 'Audio';
                break;
              case 'document':
                lastMessageContent = normalizedMessage.media_filename || 'Document';
                break;
              case 'location':
                lastMessageContent = 'Location';
                break;
              case 'contact':
                lastMessageContent = 'Contact';
                break;
              default:
                lastMessageContent = 'New message';
            }
          }

            const updatedConv = {
              ...conv,
              last_message_content: lastMessageContent,
              last_message_type: normalizedMessage.message_type || 'text',
              last_message_at: normalizedMessage.timestamp,
              last_message_direction: normalizedMessage.direction,
              unread_count: normalizedMessage.direction === 'inbound' ? conv.unread_count + 1 : conv.unread_count,
              last_message_time_ago: 'Just now'
            };
            
            return updatedConv;
          }
          return conv;
        });
        
        // Move the updated conversation to the top of the list (like WhatsApp)
        const conversationToMove = updatedConversations.find(conv => conv.id === conversationId);
        const otherConversations = updatedConversations.filter(conv => conv.id !== conversationId);
        
        const finalConversations = conversationToMove 
          ? [conversationToMove, ...otherConversations]
          : updatedConversations;
        
        return finalConversations;
      });
      
      // Force conversation list re-render
      setConversationUpdateTrigger(prev => prev + 1);
    }

    // Add message to current conversation if it's selected (always allow chat window messages)
    const currentSelectedConversation = selectedConversationRef.current;
    if (currentSelectedConversation?.id === conversationId) {
      setMessages(prev => {
        const whatsappId = normalizedMessage.whatsapp_message_id;
        const messageUid = normalizedMessage.uid;
        
        // Skip if we don't have a valid message identifier
        if (!whatsappId && !messageUid) {
          return prev;
        }
        
        // For outbound messages, use enhanced deduplication
        if (normalizedMessage.direction === 'outbound') {
          // Check sent messages tracker (for confirmed sent messages) - more strict matching
          if (whatsappId && sentMessagesTracker.current.has(whatsappId)) {
            return prev;
          }
          
          // Check pending messages tracker with improved key generation
          const messageContent = normalizedMessage.message_content?.trim() || '';
          const messageTimestamp = new Date(normalizedMessage.timestamp).getTime();
          const timeWindow = Math.floor(messageTimestamp / 3000); // 3-second window (shorter for better precision)
          const messageKey = `${messageContent}_${timeWindow}`;
          
          if (messageContent && pendingSentMessages.current.has(messageKey)) {
            return prev;
          }
        }
        
        // Check if this exact message already exists using multiple identifiers
        const messageExists = prev.some(msg => {
          // Primary check: whatsapp_message_id
          if (whatsappId && msg.whatsapp_message_id === whatsappId) {
            return true;
          }
          
          // Secondary check: uid
          if (messageUid && msg.uid === messageUid) {
            return true;
          }
          
          // Tertiary check: content + timestamp (for edge cases)
          if (normalizedMessage.direction === 'outbound' && msg.direction === 'outbound') {
            const msgTime = new Date(msg.timestamp).getTime();
            const newTime = new Date(normalizedMessage.timestamp).getTime();
            const timeDiff = Math.abs(msgTime - newTime);
            
            // If same content and timestamp within 5 seconds, consider it duplicate
            if (msg.message_content === normalizedMessage.message_content && timeDiff < 5000) {
              return true;
            }
          }
          
          return false;
        });
        
        if (messageExists) {
          return prev;
        }
        
        // Message doesn't exist, add it
        const newMessages = [...prev, normalizedMessage];
        
        // Scroll to bottom for new messages
        if (currentSelectedConversation) {
          setTimeout(() => scrollToBottom(false), 100);
          setTimeout(() => scrollToBottom(true), 300);
        }
        
        return newMessages;
      });
      
      // Mark as read if it's an incoming message
      if (normalizedMessage.direction === 'inbound') {
        markConversationAsRead(currentSelectedConversation.id);
      }
    }
  };

  // Handle new conversation
  const handleNewConversation = (conversation) => {
    setConversations(prev => [conversation, ...prev]);
  };

  // Handle message status update
  const handleMessageStatusUpdate = (messageId, status) => {
    setMessages(prev => prev.map(msg => 
      msg.whatsapp_message_id === messageId 
        ? { ...msg, status } 
        : msg
    ));
  };

  // Load conversations (initial load or search)
  const loadConversations = async (search = '', resetPagination = true) => {
    try {
      if (resetPagination) {
        setConversationPage(1);
      }
      
      const params = new URLSearchParams({
        page: 1,
        limit: 20,
        ...(search && { search })
      });
      
      const response = await axiosInstance.get(`/api/conversations?${params}`);
      
      if (response.data.success) {
        setConversations(response.data.data.conversations);
        setHasMoreConversations(response.data.data.pagination.hasNextPage);
        setConversationPage(1);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // Load more conversations for infinite scrolling
  const loadMoreConversations = async () => {
    if (loadingMoreConversations || !hasMoreConversations) {
      return;
    }

    try {
      setLoadingMoreConversations(true);
      const nextPage = conversationPage + 1;
      
      const params = new URLSearchParams({
        page: nextPage,
        limit: 20,
        ...(searchTerm && { search: searchTerm })
      });
      
      const response = await axiosInstance.get(`/api/conversations?${params}`);
      
      if (response.data.success) {
        const newConversations = response.data.data.conversations;
        
        // Append new conversations to existing ones, avoiding duplicates
        setConversations(prev => {
          const existingIds = new Set(prev.map(c => c.uid));
          const uniqueNewConversations = newConversations.filter(c => !existingIds.has(c.id));
          return [...prev, ...uniqueNewConversations];
        });
        
        setHasMoreConversations(response.data.data.pagination.hasNextPage);
        setConversationPage(nextPage);
      }
    } catch (error) {
      console.error('Error loading more conversations:', error);
    } finally {
      setLoadingMoreConversations(false);
    }
  };

  // Load conversation stats
  const loadStats = async () => {
    try {
      const response = await axiosInstance.get('/api/conversations/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId) => {
    try {
      // Clear all trackers when switching conversations for clean state
      sentMessagesTracker.current.clear();
      pendingSentMessages.current.clear();
      messageProcessingLock.current.clear();
      
      const response = await axiosInstance.get(`/api/conversations/${conversationId}`);
      
      if (response.data.success) {
        setMessages(response.data.data.messages);
        
        // Update selectedConversation only if we got conversation data from API
        if (response.data.data.conversation) {
          setSelectedConversation(response.data.data.conversation);
        }
        
        // Mark conversation as read
        markConversationAsRead(conversationId);
        
        // Scroll to bottom after loading messages
        setTimeout(() => scrollToBottom(true), 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Send message (handles both text and media)
  const handleSendMessage = async (messageData) => {
    
    if ((!messageData.text?.trim() && !messageData.attachments?.length) || !selectedConversation) {
      return;
    }

    const hasText = messageData.text?.trim();
    const hasAttachments = messageData.attachments?.length > 0;
    
    const tempMessage = {
      uid: `temp-${Date.now()}`,
      whatsapp_message_id: `temp-${Date.now()}`,
      message_content: hasText ? messageData.text.trim() : (hasAttachments ? `Uploading ${messageData.attachments[0].type}...` : ''),
      direction: 'outbound',
      message_type: hasAttachments ? messageData.attachments[0].type : 'text',
      timestamp: new Date().toISOString(),
      status: 'pending',
      from_phone: selectedConversation.contact_phone,
      to_phone: selectedConversation.whatsapp_phone_number_id,
      ...(hasAttachments && {
        media_filename: messageData.attachments[0].file.name,
        media_mime_type: messageData.attachments[0].file.type,
        media_caption: hasText ? messageData.text.trim() : null
      })
    };

    console.log('📝 Created temporary message:', tempMessage);

    // Track this message immediately to prevent duplicates (use same logic as deduplication)
    const messageContent = tempMessage.message_content?.trim() || '';
    const messageTimestamp = new Date(tempMessage.timestamp).getTime();
    const timeWindow = Math.floor(messageTimestamp / 3000); // 3-second window to match deduplication
    const messageKey = `${messageContent}_${timeWindow}`;
    
    if (messageContent) {
      pendingSentMessages.current.set(messageKey, {
        tempUid: tempMessage.uid,
        timestamp: tempMessage.timestamp,
        content: tempMessage.message_content,
        whatsappId: null // Will be set when API responds
      });
    }

    // Add temporary message to UI
    setMessages(prev => [...prev, tempMessage]);

    try {
      let response;
      
      if (hasAttachments) {
        // Handle media message - two-step process: upload file first, then send message
        console.log('📎 Sending media message');
        const attachment = messageData.attachments[0];
        
        // Step 1: Upload the media file to get a URL
        console.log('📤 Step 1: Uploading media file...');
        
        // Update temp message to show uploading status
        setMessages(prev => prev.map(msg => 
          msg.uid === tempMessage.uid 
            ? { ...msg, message_content: hasText ? messageData.text.trim() : 'Uploading...', status: 'pending' }
            : msg
        ));
        
        const uploadFormData = new FormData();
        uploadFormData.append('files', attachment.file);
        
        const uploadResponse = await axiosInstance.post(
          `/api/media/upload`,
          uploadFormData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            timeout: 30000,
          }
        );
        
        if (!uploadResponse.data.success) {
          throw new Error('Failed to upload media file');
        }
        
        const mediaUrl = uploadResponse.data.data[0].url;
        console.log('✅ Media uploaded successfully:', mediaUrl);
        
        // Update temp message to show sending status
        setMessages(prev => prev.map(msg => 
          msg.uid === tempMessage.uid 
            ? { ...msg, message_content: hasText ? messageData.text.trim() : 'Sending...', status: 'pending', media_url: mediaUrl }
            : msg
        ));
        
        // Step 2: Send the message with the media URL
        console.log('📤 Step 2: Sending message with media URL...');
        const messageContent = hasText ? messageData.text.trim() : '';
        
        response = await axiosInstance.post(
          `/api/conversations/${selectedConversation.id}/messages`,
          {
            message_type: attachment.type,
            media_url: mediaUrl,
            message_content: messageContent,
            ...(hasText && { media_caption: messageData.text.trim() })
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
      } else {
        // Handle text message
        console.log('💬 Sending text message');
        response = await axiosInstance.post(
          `/api/conversations/${selectedConversation.id}/messages`,
          {
            message_type: 'text',
            message_content: messageData.text.trim()
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000, // 10 second timeout for text
          }
        );
      }

      console.log('✅ Message sent successfully:', response.data);

      if (response.data.success) {
        // Replace temporary message with real one
        const realMessage = response.data.data.message;
        console.log('🔄 Replacing temp message with real message:', realMessage);
        
        // Track this message to prevent duplicates
        if (realMessage.whatsapp_message_id) {
          sentMessagesTracker.current.add(realMessage.whatsapp_message_id);
          
          // Clean up pending tracker for this message (use same key logic)
          const messageContent = realMessage.message_content?.trim() || '';
          const messageTimestamp = new Date(realMessage.timestamp).getTime();
          const timeWindow = Math.floor(messageTimestamp / 3000); // 3-second window to match
          const messageKey = `${messageContent}_${timeWindow}`;
          
          if (messageContent && pendingSentMessages.current.has(messageKey)) {
            pendingSentMessages.current.delete(messageKey);
          }
          
          // Clean up sent tracker after 30 seconds to prevent memory leaks
          setTimeout(() => {
            sentMessagesTracker.current.delete(realMessage.whatsapp_message_id);
          }, 30000);
        }
        
        setMessages(prev => prev.map(msg => 
          msg.uid === tempMessage.uid 
            ? realMessage 
            : msg
        ));
        
        // Update conversation in list with proper message content and type
        setConversations(prev => {
          const updatedConversations = prev.map(conv => 
            conv.id === selectedConversation.id 
              ? {
                  ...conv,
                  last_message_content: hasText ? messageData.text.trim() : (hasAttachments ? messageData.attachments[0].file.name : 'Message sent'),
                  last_message_type: hasAttachments ? messageData.attachments[0].type : 'text',
                  last_message_at: new Date().toISOString(),
                  last_message_direction: 'outbound',
                  last_message_time_ago: 'Just now'
                }
              : conv
          );
          
          // Move the updated conversation to top for sent messages too
          const conversationToMove = updatedConversations.find(conv => conv.id === selectedConversation.id);
          const otherConversations = updatedConversations.filter(conv => conv.id !== selectedConversation.id);
          
          const finalConversations = conversationToMove 
            ? [conversationToMove, ...otherConversations]
            : updatedConversations;
          
          return finalConversations;
        });
        
        // Force conversation list re-render for sent messages
        setConversationUpdateTrigger(prev => prev + 1);
        
        // Ensure scroll to bottom for sent messages
        setTimeout(() => scrollToBottom(true), 100);
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      // Log detailed error information
      if (error.response) {
        console.error('📊 Error response data:', error.response.data);
        console.error('📊 Error response status:', error.response.status);
        console.error('📊 Error response headers:', error.response.headers);
      }
      
      // Clean up pending tracker on error (use same key logic)
      const messageContent = tempMessage.message_content?.trim() || '';
      const messageTimestamp = new Date(tempMessage.timestamp).getTime();
      const timeWindow = Math.floor(messageTimestamp / 3000);
      const messageKey = `${messageContent}_${timeWindow}`;
      
      if (messageContent && pendingSentMessages.current.has(messageKey)) {
        pendingSentMessages.current.delete(messageKey);
      }
      
      // Remove temporary message on error and show user-friendly message
      setMessages(prev => prev.filter(msg => msg.uid !== tempMessage.uid));
      
      // Show error message to user (you could use toast notifications here)
      alert(`Failed to send message: ${error.response?.data?.message || error.message}`);
    }
  };

  // Handle media attachment
  const handleAttachMedia = (attachments) => {
    console.log('Media attached:', attachments);
  };

  // Mark conversation as read
  const markConversationAsRead = async (conversationId) => {
    try {
      await axiosInstance.post(`/api/conversations/${conversationId}/read`);
      
      // Update conversation in list
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unread_count: 0 }
          : conv
      ));
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    // Only trigger auto-scroll if we have a selected conversation and messages
    if (!selectedConversation || messages.length === 0) {
      return;
    }
    
    // Use multiple timing approaches to ensure scroll works
    requestAnimationFrame(() => scrollToBottom(false));
    setTimeout(() => scrollToBottom(true), 200);
  }, [messages, selectedConversation]);

  // Additional scroll-to-bottom handler for new messages
  const scrollToBottom = (force = false) => {
    if (!messagesEndRef.current) {
      // Try to find the scroll target by ID as fallback
      const scrollTarget = document.getElementById('messages-end-anchor');
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ 
          behavior: force ? 'auto' : 'smooth',
          block: 'end' 
        });
      }
      return;
    }

    const scrollOptions = {
      behavior: force ? 'auto' : 'smooth',
      block: 'end',
      inline: 'nearest'
    };
    
    // Method 1: scrollIntoView
    try {
      messagesEndRef.current.scrollIntoView(scrollOptions);
    } catch (error) {
      // Silent fallback
    }
    
    // Method 2: Direct container scrolling
    try {
      const messagesContainer = messagesEndRef.current.closest('.overflow-y-auto');
      if (messagesContainer) {
        const scrollTop = messagesContainer.scrollHeight - messagesContainer.clientHeight;
        
        if (force) {
          messagesContainer.scrollTop = scrollTop;
        } else {
          messagesContainer.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        }
      }
    } catch (error) {
      // Silent fallback
    }
    
    // Method 3: Backup using parent element scrolling
    try {
      const parentContainer = messagesEndRef.current.parentElement?.parentElement;
      if (parentContainer && parentContainer.classList.contains('overflow-y-auto')) {
        parentContainer.scrollTop = parentContainer.scrollHeight;
      }
    } catch (error) {
      // Silent fallback
    }
  };

  // Update "time ago" display periodically - optimized to avoid unnecessary re-renders
  useEffect(() => {
    const updateTimeAgo = () => {
      setConversations(prev => {
        // Check if any time display actually needs updating before triggering re-render
        const needsUpdate = prev.some(conv => {
          const newTimeAgo = conv.last_message_at ? formatRelativeTime(conv.last_message_at) : '';
          return newTimeAgo !== conv.last_message_time_ago;
        });
        
        if (!needsUpdate) {
          return prev; // Return same reference to prevent re-render
        }
        
        return prev.map(conv => ({
          ...conv,
          last_message_time_ago: conv.last_message_at ? formatRelativeTime(conv.last_message_at) : ''
        }));
      });
    };

    // Update immediately and then every minute
    const interval = setInterval(updateTimeAgo, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Force conversation list re-render when update trigger changes
  useEffect(() => {
    if (conversationUpdateTrigger > 0) {
      // Force a small state update to trigger re-render
      setTimeout(() => {
        setConversations(prev => [...prev]);
      }, 10);
    }
  }, [conversationUpdateTrigger]);

  // Handle search
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm !== '') {
        loadConversations(searchTerm, true);
      } else {
        loadConversations('', true);
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  // Setup Intersection Observer for infinite scroll
  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    const options = {
      root: conversationsContainerRef.current,
      rootMargin: '400px', // Start loading 400px before reaching the trigger element
      threshold: 0.1
    };

    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries;
      
      // Only trigger if the element is intersecting and we have more data to load
      if (entry.isIntersecting && hasMoreConversations && !loadingMoreConversations) {
        loadMoreConversations();
      }
    }, options);

    // Observe the trigger element
    if (loadMoreTriggerRef.current) {
      observerRef.current.observe(loadMoreTriggerRef.current);
    }

    // Cleanup on unmount
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMoreConversations, loadingMoreConversations, conversations.length]);

  // Helper function to truncate messages for preview - memoized
  const truncateMessage = useCallback((message, maxLength = 45) => {
    if (!message) return 'No messages yet';
    
    // Handle different message types with appropriate prefixes
    const messagePreview = getMessagePreview(message, maxLength);
    
    // If it's already truncated by getMessagePreview, return it
    if (messagePreview.includes('...')) {
      return messagePreview;
    }
    
    // Otherwise, apply our own truncation
    if (messagePreview.length > maxLength) {
      return messagePreview.substring(0, maxLength) + '...';
    }
    
    return messagePreview;
  }, []);

  // Get formatted last message for conversation preview - memoized
  const getLastMessagePreview = useCallback((conversation) => {
    // If there's no last message content, show default
    if (!conversation.last_message_content) {
      return 'No messages yet';
    }

    // Create a mock message object for getMessagePreview
    const mockMessage = {
      message_content: conversation.last_message_content,
      message_type: conversation.last_message_type || 'text',
      media_caption: null,
      media_filename: null
    };

    return truncateMessage(mockMessage);
  }, [truncateMessage]);

  // Memoized handler for selecting a conversation
  const handleSelectConversation = useCallback((conversation) => {
    // Immediately set the selected conversation from the local data
    setSelectedConversation(conversation);
    // Then load the messages
    loadMessages(conversation.id);
  }, []);

  // Format time with better error handling
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp received:', timestamp);
        return '';
      }
      
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting timestamp:', timestamp, error);
      return '';
    }
  };

  // Get message status icon
  const getMessageStatusIcon = (status, direction) => {
    if (direction !== 'outbound') return null;
    
    switch (status) {
      case 'pending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case 'failed':
        return <div className="w-3 h-3 bg-red-500 rounded-full" />;
      default:
        return null;
    }
  };

  // Get document icon based on file type
  const getDocumentIcon = (filename, mimeType) => {
    if (!filename && !mimeType) return '📄';
    
    const extension = filename ? filename.split('.').pop()?.toLowerCase() : '';
    
    // Check by MIME type first
    if (mimeType) {
      if (mimeType.includes('pdf')) return '📄';
      if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
      if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
      if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📋';
      if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return '🗜️';
      if (mimeType.includes('text')) return '📃';
    }
    
    // Check by extension
    switch (extension) {
      case 'pdf': return '📄';
      case 'doc': case 'docx': return '📝';
      case 'xls': case 'xlsx': return '📊';
      case 'ppt': case 'pptx': return '📋';
      case 'zip': case 'rar': case '7z': return '🗜️';
      case 'txt': case 'text': return '📃';
      case 'json': case 'xml': return '🔧';
      case 'csv': return '📈';
      default: return '📄';
    }
  };

  // Get file size from URL (placeholder function)
  const getFileSize = (url) => {
    // This would typically require a HEAD request or file info from backend
    // For now, return null - can be enhanced to show actual file size
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2A7B6E]"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Conversations Sidebar */}
      <div className={`${selectedConversation ? 'hidden lg:block' : 'block'} w-full lg:w-1/3 xl:w-1/4 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Chats</h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${pubsubConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-xs text-gray-500">
                {pubsubConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-sm font-medium text-gray-600">Total Chats</div>
              <div className="text-lg font-bold text-gray-900">{stats.total_conversations || 0}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Unread</div>
              <div className="text-lg font-bold text-[#2A7B6E]">{stats.unread_conversations || 0}</div>
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 min-h-0">
          <div 
            ref={conversationsContainerRef}
            className="h-full overflow-y-auto overflow-x-hidden" 
            style={{ scrollBehavior: 'smooth' }}
          >
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageCircle className="w-12 h-12 mb-2" />
              <p>No conversations yet</p>
              <p className="text-sm">Your WhatsApp chats will appear here</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversation?.id === conversation.id}
                onSelect={() => handleSelectConversation(conversation)}
                getLastMessagePreview={getLastMessagePreview}
              />
            ))
          )}
          
          {/* Intersection Observer trigger element - positioned before loading indicator */}
          {hasMoreConversations && conversations.length > 0 && (
            <div 
              ref={loadMoreTriggerRef}
              className="h-1 w-full"
              style={{ minHeight: '1px' }}
            />
          )}
          
          {/* Loading indicator for infinite scroll */}
          {loadingMoreConversations && (
            <div className="p-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#2A7B6E]"></div>
              <span className="ml-2 text-sm text-gray-500">Loading more...</span>
            </div>
          )}
          
          {/* End of list indicator */}
          {!hasMoreConversations && conversations.length > 0 && (
            <div className="p-4 text-center text-sm text-gray-500">
              No more conversations
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${selectedConversation ? 'block' : 'hidden lg:block'} flex-1 flex flex-col h-full overflow-hidden`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="lg:hidden p-1 rounded-full hover:bg-gray-100"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="w-10 h-10 bg-[#2A7B6E] rounded-full flex items-center justify-center text-white font-medium">
                    {selectedConversation.display_name?.[0]?.toUpperCase() || selectedConversation.contact_phone?.[0] || '?'}
                  </div>
                  
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      {selectedConversation.display_name || selectedConversation.contact_phone}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedConversation.contact_phone}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="relative flex-1 min-h-0">
              
              <div 
                className="h-full overflow-y-auto overflow-x-hidden p-4 space-y-4 bg-gray-50" 
                style={{ scrollBehavior: 'smooth' }}
                onScroll={(e) => {
                  // Prevent scroll event from bubbling up
                  e.stopPropagation();
                }}
              >
              {messages.map((message, index) => (
                <div
                  key={message.uid || message.whatsapp_message_id}
                  className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md rounded-lg ${
                      message.direction === 'outbound'
                        ? 'bg-[#2A7B6E] text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    {/* Media Content */}
                    {message.media_url && (
                      <div className="rounded-t-lg overflow-hidden">
                        {message.message_type === 'image' && (
                          <div className="relative cursor-pointer" onClick={() => setExpandedMedia({ type: 'image', url: message.media_url, caption: message.media_caption })}>
                            <img 
                              src={message.media_url} 
                              alt={message.media_caption || 'Image'} 
                              className="w-48 h-36 object-cover rounded-lg hover:opacity-90 transition-opacity"
                              onError={(e) => {
                                // Show error placeholder instead of hiding
                                e.target.style.display = 'none';
                                const placeholder = e.target.nextElementSibling;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                            <div 
                              className="hidden w-48 h-36 bg-gray-200 items-center justify-center text-gray-500 text-sm rounded-lg"
                            >
                              <div className="text-center">
                                <div className="text-2xl mb-2">🖼️</div>
                                <div>Image not available</div>
                              </div>
                            </div>
                            {/* Expand indicator overlay */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                              <div className="opacity-0 hover:opacity-100 transition-opacity bg-black bg-opacity-50 rounded-full p-2">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        )}
                        {message.message_type === 'video' && (
                          <div className="relative cursor-pointer" onClick={() => setExpandedMedia({ type: 'video', url: message.media_url, caption: message.media_caption })}>
                            <video 
                              src={message.media_url} 
                              preload="metadata"
                              className="w-48 h-36 object-cover rounded-lg hover:opacity-90 transition-opacity"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const placeholder = e.target.nextElementSibling;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                            <div 
                              className="hidden w-48 h-36 bg-gray-200 items-center justify-center text-gray-500 text-sm rounded-lg"
                            >
                              <div className="text-center">
                                <div className="text-2xl mb-2">🎥</div>
                                <div>Video not available</div>
                              </div>
                            </div>
                            {/* Play button overlay */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                              <div className="bg-black bg-opacity-50 rounded-full p-3 hover:bg-opacity-70 transition-all">
                                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                            </div>
                          </div>
                        )}
                        {message.message_type === 'audio' && (
                          <div className="p-3">
                            <audio 
                              src={message.media_url} 
                              controls 
                              preload="metadata"
                              className="w-full"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const placeholder = e.target.nextElementSibling;
                                if (placeholder) placeholder.style.display = 'block';
                              }}
                            />
                            <div 
                              className="hidden text-center py-4 text-gray-500 text-sm"
                            >
                              <div className="text-2xl mb-2">🎵</div>
                              <div>Audio not available</div>
                            </div>
                          </div>
                        )}
                        {message.message_type === 'document' && (
                          <div className="p-3 flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                              {getDocumentIcon(message.media_filename, message.media_mime_type)}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{message.media_filename || 'Document'}</p>
                              <p className="text-xs text-gray-500">
                                {getFileSize(message.media_url) || 'Unknown size'}
                              </p>
                              <a 
                                href={message.media_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline inline-block mt-1"
                                onClick={(e) => {
                                  // Check if file is available
                                  fetch(message.media_url, { method: 'HEAD' })
                                    .then(response => {
                                      if (!response.ok) {
                                        e.preventDefault();
                                        alert('File not available for download');
                                      }
                                    })
                                    .catch(() => {
                                      e.preventDefault();
                                      alert('File not available for download');
                                    });
                                }}
                              >
                                📥 Download
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Text Content */}
                    {(message.message_content || message.media_caption) && (
                      <div className={`px-4 py-2 ${message.media_url ? 'pt-2' : ''}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.media_caption || message.message_content || ''}
                        </p>
                      </div>
                    )}
                    
                    {/* Fallback for messages without content */}
                    {!message.message_content && !message.media_caption && !message.media_url && (
                      <div className="px-4 py-2">
                        <p className="text-sm text-gray-500 italic">
                          {message.message_type === 'text' 
                            ? `Message content unavailable (ID: ${message.uid || message.whatsapp_message_id})` 
                            : `${message.message_type} message`
                          }
                        </p>
                        {process.env.NODE_ENV === 'development' && (
                          <p className="text-xs text-red-500 mt-1">
                            Debug: Check Pub/Sub message structure
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Message Footer */}
                    <div className={`flex items-center justify-between px-4 pb-2 ${
                      !message.message_content && !message.media_caption ? 'pt-2' : 'pt-1'
                    } gap-2`}>
                      <p className={`text-xs ${
                        message.direction === 'outbound' ? 'text-white/70' : 'text-gray-500'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                      
                      {getMessageStatusIcon(message.status, message.direction)}
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Scroll anchor with proper positioning and visibility for debugging */}
              <div 
                ref={messagesEndRef} 
                id="messages-end-anchor"
                className="h-4 flex-shrink-0"
                style={{ 
                  minHeight: '16px',
                  background: process.env.NODE_ENV === 'development' ? 'rgba(255, 0, 0, 0.1)' : 'transparent',
                  border: process.env.NODE_ENV === 'development' ? '1px dashed red' : 'none'
                }}
              >
                {process.env.NODE_ENV === 'development' && (
                  <span className="text-xs text-red-500">📍 Scroll Target</span>
                )}
              </div>
              </div>
            </div>

            {/* Message Input */}
            <MessageComposer
              onSendMessage={handleSendMessage}
              onAttachMedia={handleAttachMedia}
              disabled={!selectedConversation}
              placeholder="Type a message..."
            />
          </>
        ) : (
          /* No Conversation Selected */
          <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-600 mb-2">Select a conversation</h2>
              <p className="text-gray-500">Choose a conversation from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Media Expansion Modal */}
      {expandedMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setExpandedMedia(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            {/* Close Button */}
            <button
              onClick={() => setExpandedMedia(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors z-10"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Media Content */}
            <div className="bg-white rounded-lg overflow-hidden max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
              {expandedMedia.type === 'image' && (
                <div className="relative">
                  <img 
                    src={expandedMedia.url} 
                    alt={expandedMedia.caption || 'Expanded image'} 
                    className="max-w-full max-h-[80vh] object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const placeholder = e.target.nextElementSibling;
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="hidden w-full h-64 bg-gray-200 items-center justify-center text-gray-500"
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-4">🖼️</div>
                      <div className="text-lg">Image could not be loaded</div>
                    </div>
                  </div>
                  {expandedMedia.caption && (
                    <div className="p-4 bg-white border-t">
                      <p className="text-gray-700 text-sm">{expandedMedia.caption}</p>
                    </div>
                  )}
                </div>
              )}
              
              {expandedMedia.type === 'video' && (
                <div className="relative">
                  <video 
                    src={expandedMedia.url} 
                    controls 
                    autoPlay
                    className="max-w-full max-h-[80vh] object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const placeholder = e.target.nextElementSibling;
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="hidden w-full h-64 bg-gray-200 items-center justify-center text-gray-500"
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-4">🎥</div>
                      <div className="text-lg">Video could not be loaded</div>
                    </div>
                  </div>
                  {expandedMedia.caption && (
                    <div className="p-4 bg-white border-t">
                      <p className="text-gray-700 text-sm">{expandedMedia.caption}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
