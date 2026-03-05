'use client';

import { memo, useCallback, useRef, useEffect, forwardRef } from 'react';
import { Search, Loader2, MessageCircle, Phone, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { getMessagePreview, formatRelativeTime } from '@/utils/chatUtils';

// Memoized conversation item for performance
const ConversationItem = memo(function ConversationItem({ 
  conversation, 
  isSelected, 
  onSelect 
}) {
  const displayName = conversation.display_name || conversation.contact_phone || 'Unknown';
  const initials = displayName.charAt(0).toUpperCase();
  
  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [conversation, onSelect]);
  
  // Get last message preview
  const lastMessagePreview = getMessagePreview({
    message_content: conversation.last_message_content,
    message_type: conversation.last_message_type,
    media_caption: null,
    media_filename: null
  }, 40);
  
  const timeAgo = conversation.last_message_at 
    ? formatRelativeTime(conversation.last_message_at) 
    : '';
  
  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 p-3 hover:bg-[#F0F2F5] transition-colors text-left ${
        isSelected ? 'bg-[#F0F2F5]' : ''
      }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#D1D7DB] flex items-center justify-center">
        {conversation.profile_picture ? (
          <img 
            src={conversation.profile_picture} 
            alt={displayName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span className="text-lg font-medium text-[#54656F]">
            {initials}
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="font-medium text-[#111B21] truncate">
            {displayName}
          </span>
          <span className="text-xs text-[#667781] flex-shrink-0 ml-2">
            {timeAgo}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {conversation.last_message_direction === 'outbound' && (
              <span className="flex-shrink-0">
                {conversation.last_message_status === 'read' ? (
                  <CheckCheck className="w-4 h-4 text-[#53BDEB]" />
                ) : conversation.last_message_status === 'delivered' ? (
                  <CheckCheck className="w-4 h-4 text-[#667781]" />
                ) : (
                  <Check className="w-4 h-4 text-[#667781]" />
                )}
              </span>
            )}
            <span className="text-sm text-[#667781] truncate">
              {lastMessagePreview}
            </span>
          </div>
          
          {conversation.unread_count > 0 && (
            <span className="flex-shrink-0 ml-2 min-w-[20px] h-5 px-1.5 bg-[#25D366] text-white text-xs font-medium rounded-full flex items-center justify-center">
              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo
  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.last_message_at === nextProps.conversation.last_message_at &&
    prevProps.conversation.unread_count === nextProps.conread_count &&
    prevProps.conversation.last_message_status === nextProps.conversation.last_message_status &&
    prevProps.isSelected === nextProps.isSelected
  );
});

// Loading skeleton for conversations
const ConversationSkeleton = () => (
  <div className="flex items-center gap-3 p-3 animate-pulse">
    <div className="w-12 h-12 rounded-full bg-[#E9EDEF]" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-[#E9EDEF] rounded w-3/4" />
      <div className="h-3 bg-[#E9EDEF] rounded w-1/2" />
    </div>
  </div>
);

// Main ConversationList component
export default function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  searchTerm,
  onSearchChange,
  loading,
  loadingMore,
  hasMore,
  onLoadMore
}) {
  const listRef = useRef(null);
  const loadMoreRef = useRef(null);
  const observerRef = useRef(null);
  
  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore) {
          onLoadMore?.();
        }
      },
      { root: listRef.current, rootMargin: '200px', threshold: 0 }
    );
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);
  
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search Header */}
      <div className="p-2 bg-[#F0F2F5]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#54656F]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search or start new chat"
            className="w-full pl-11 pr-4 py-2 bg-white rounded-lg text-sm text-[#111B21] placeholder-[#54656F] focus:outline-none"
          />
        </div>
      </div>
      
      {/* Conversation List */}
      <div 
        ref={listRef}
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#D1D7DB transparent' }}
      >
        {loading ? (
          // Loading skeletons
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-[#E9EDEF] rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-[#54656F]" />
            </div>
            <p className="text-[#54656F] text-sm">
              {searchTerm ? 'No conversations found' : 'No conversations yet'}
            </p>
            <p className="text-[#8696A0] text-xs mt-1">
              {searchTerm ? 'Try a different search term' : 'Start a new conversation'}
            </p>
          </div>
        ) : (
          <>
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id || conversation.uid}
                conversation={conversation}
                isSelected={selectedConversation?.id === conversation.id}
                onSelect={onSelectConversation}
              />
            ))}
            
            {/* Load more trigger */}
            <div ref={loadMoreRef} className="h-4">
              {loadingMore && (
                <div className="flex justify-center py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#54656F]" />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
