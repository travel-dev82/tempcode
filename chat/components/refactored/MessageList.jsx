'use client';

import { memo, useRef, useEffect, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import MessageBubble from './MessageBubble';

// Group messages by date
const groupMessagesByDate = (messages) => {
  const groups = [];
  const groupMap = new Map();
  
  messages.forEach((msg) => {
    const date = new Date(msg.timestamp);
    const dateKey = date.toDateString();
    
    if (!groupMap.has(dateKey)) {
      const group = { date: dateKey, messages: [] };
      groupMap.set(dateKey, group);
      groups.push(group);
    }
    
    groupMap.get(dateKey).messages.push(msg);
  });
  
  return groups;
};

// Format date label
const formatDateLabel = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Date divider component
const DateDivider = memo(function DateDivider({ date }) {
  return (
    <div className="flex justify-center py-2">
      <div className="bg-[#E9EDEF] text-[#54656F] text-xs px-3 py-1 rounded-lg shadow-sm">
        {formatDateLabel(date)}
      </div>
    </div>
  );
});

// Loading more indicator
const LoadingIndicator = () => (
  <div className="flex justify-center py-4">
    <Loader2 className="w-5 h-5 animate-spin text-[#00A884]" />
  </div>
);

// Message group component (optimized)
const MessageGroup = memo(function MessageGroup({ group, selectedConversation }) {
  return (
    <>
      <DateDivider date={group.date} />
      {group.messages.map((message, index) => {
        // Check if this is the last message in a sequence from the same sender
        const prevMessage = group.messages[index - 1];
        const nextMessage = group.messages[index + 1];
        const showTail = !nextMessage || nextMessage.direction !== message.direction;
        
        return (
          <div 
            key={message.uid || message.whatsapp_message_id || index}
            className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'} mb-1`}
          >
            <MessageBubble 
              message={message}
              isOwn={message.direction === 'outbound'}
              showTail={showTail}
            />
          </div>
        );
      })}
    </>
  );
});

// Main MessageList component
export default function MessageList({
  messages,
  loading,
  loadingMore,
  selectedConversation,
  onLoadMore,
  hasMore,
  scrollToBottom = true
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const shouldScrollToBottomRef = useRef(true);
  
  // Group messages by date (memoized)
  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);
  
  // Handle scroll to load more
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !hasMore || loadingMore) return;
    
    const { scrollTop, scrollHeight } = containerRef.current;
    
    // Store current scroll position
    prevScrollHeightRef.current = scrollHeight;
    
    // If scrolled near top, load more
    if (scrollTop < 100 && hasMore && !loadingMore) {
      shouldScrollToBottomRef.current = false;
      onLoadMore?.();
    }
  }, [hasMore, loadingMore, onLoadMore]);
  
  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (!scrollToBottom || !bottomRef.current || !shouldScrollToBottomRef.current) return;
    
    bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, scrollToBottom]);
  
  // Maintain scroll position when loading more messages
  useEffect(() => {
    if (!containerRef.current || shouldScrollToBottomRef.current) return;
    
    const newScrollHeight = containerRef.current.scrollHeight;
    const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
    containerRef.current.scrollTop = scrollDiff;
    
    shouldScrollToBottomRef.current = true;
  }, [messages.length]);
  
  // Show empty state
  if (!loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#EFEAE2]">
        <div className="text-center p-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#E9EDEF] rounded-full flex items-center justify-center">
            <span className="text-3xl">💬</span>
          </div>
          <p className="text-[#54656F] text-sm">No messages yet</p>
          <p className="text-[#8696A0] text-xs mt-1">Start the conversation!</p>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4"
      style={{ 
        scrollbarWidth: 'thin', 
        scrollbarColor: '#D1D7DB transparent',
        background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1d7db' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        backgroundColor: '#EFEAE2'
      }}
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-[#00A884]" />
        </div>
      ) : (
        <>
          {loadingMore && <LoadingIndicator />}
          
          {groupedMessages.map((group, index) => (
            <MessageGroup 
              key={group.date} 
              group={group}
              selectedConversation={selectedConversation}
            />
          ))}
          
          {/* Scroll anchor */}
          <div ref={bottomRef} className="h-4" />
        </>
      )}
    </div>
  );
}
