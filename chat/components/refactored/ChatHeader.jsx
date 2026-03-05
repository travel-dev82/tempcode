'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, Phone, Video, MoreVertical, Search, 
  User, Star, Ban, Trash2, VolumeX, Image,
  Flag, ChevronDown, X
} from 'lucide-react';

// Contact info panel
const ContactInfoPanel = memo(function ContactInfoPanel({ 
  conversation, 
  onClose 
}) {
  const displayName = conversation?.display_name || conversation?.contact_phone || 'Unknown';
  
  return (
    <div className="absolute inset-0 bg-white z-30 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-[#00A884] text-white">
        <button onClick={onClose} className="p-1">
          <X className="w-5 h-5" />
        </button>
        <span className="font-medium">Contact Info</span>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Avatar and name */}
        <div className="flex flex-col items-center py-6 bg-[#F0F2F5]">
          <div className="w-28 h-28 rounded-full bg-[#D1D7DB] flex items-center justify-center mb-3">
            {conversation?.profile_picture ? (
              <img 
                src={conversation.profile_picture}
                alt={displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-4xl font-medium text-[#54656F]">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h2 className="text-lg font-medium text-[#111B21]">{displayName}</h2>
          <p className="text-sm text-[#54656F]">{conversation?.contact_phone}</p>
        </div>
        
        {/* Actions */}
        <div className="bg-white mt-2">
          <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#F0F2F5] transition-colors">
            <Star className="w-5 h-5 text-[#54656F]" />
            <span className="text-sm text-[#111B21]">Starred Messages</span>
          </button>
          <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#F0F2F5] transition-colors">
            <VolumeX className="w-5 h-5 text-[#54656F]" />
            <span className="text-sm text-[#111B21]">Mute Notifications</span>
          </button>
          <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#F0F2F5] transition-colors text-red-500">
            <Ban className="w-5 h-5" />
            <span className="text-sm">Block Contact</span>
          </button>
          <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#F0F2F5] transition-colors text-red-500">
            <Flag className="w-5 h-5" />
            <span className="text-sm">Report Contact</span>
          </button>
          <button className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#F0F2F5] transition-colors text-red-500">
            <Trash2 className="w-5 h-5" />
            <span className="text-sm">Delete Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
});

// Main ChatHeader component
export default function ChatHeader({
  conversation,
  onBack,
  connected = true,
  showBackButton = false
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  
  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
  
  if (!conversation) {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-[#F0F2F5] border-b border-[#E9EDEF]">
        <p className="text-[#8696A0] text-sm">Select a conversation</p>
      </div>
    );
  }
  
  const displayName = conversation.display_name || conversation.contact_phone || 'Unknown';
  const lastSeen = conversation.last_active 
    ? `last seen ${new Date(conversation.last_active).toLocaleTimeString()}`
    : 'online';
  
  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 bg-[#F0F2F5] border-b border-[#E9EDEF]">
        {/* Left section */}
        <div className="flex items-center gap-3">
          {/* Back button (mobile) */}
          {showBackButton && (
            <button 
              onClick={onBack}
              className="p-1 -ml-1 text-[#54656F] hover:text-[#111B21] lg:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          
          {/* Avatar and info - clickable */}
          <button 
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 rounded-full bg-[#D1D7DB] flex items-center justify-center overflow-hidden">
              {conversation.profile_picture ? (
                <img 
                  src={conversation.profile_picture}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg font-medium text-[#54656F]">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="text-left">
              <h2 className="font-medium text-[#111B21] text-[15px]">
                {displayName}
              </h2>
              <p className="text-xs text-[#8696A0]">
                {connected ? lastSeen : 'Connecting...'}
              </p>
            </div>
          </button>
        </div>
        
        {/* Right section - actions */}
        <div className="flex items-center gap-1">
          <button 
            className="w-9 h-9 flex items-center justify-center text-[#54656F] hover:text-[#111B21] hover:bg-[#E9EDEF] rounded-full transition-colors"
            title="Video call"
          >
            <Video className="w-5 h-5" />
          </button>
          
          <button 
            className="w-9 h-9 flex items-center justify-center text-[#54656F] hover:text-[#111B21] hover:bg-[#E9EDEF] rounded-full transition-colors"
            title="Voice call"
          >
            <Phone className="w-5 h-5" />
          </button>
          
          <button 
            className="w-9 h-9 flex items-center justify-center text-[#54656F] hover:text-[#111B21] hover:bg-[#E9EDEF] rounded-full transition-colors"
            title="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="w-9 h-9 flex items-center justify-center text-[#54656F] hover:text-[#111B21] hover:bg-[#E9EDEF] rounded-full transition-colors"
              title="Menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-[#E9EDEF] overflow-hidden z-50">
                <button 
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] transition-colors text-left"
                  onClick={() => {
                    setShowInfo(true);
                    setShowMenu(false);
                  }}
                >
                  <User className="w-5 h-5 text-[#54656F]" />
                  <span className="text-sm text-[#111B21]">Contact Info</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] transition-colors text-left">
                  <Star className="w-5 h-5 text-[#54656F]" />
                  <span className="text-sm text-[#111B21]">Starred Messages</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] transition-colors text-left">
                  <VolumeX className="w-5 h-5 text-[#54656F]" />
                  <span className="text-sm text-[#111B21]">Mute Notifications</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] transition-colors text-left">
                  <Image className="w-5 h-5 text-[#54656F]" />
                  <span className="text-sm text-[#111B21]">Wallpaper</span>
                </button>
                <div className="border-t border-[#E9EDEF]" />
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] transition-colors text-left text-red-500">
                  <Ban className="w-5 h-5" />
                  <span className="text-sm">Block {displayName}</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] transition-colors text-left text-red-500">
                  <Flag className="w-5 h-5" />
                  <span className="text-sm">Report {displayName}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Contact info panel */}
      {showInfo && (
        <ContactInfoPanel 
          conversation={conversation}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  );
}
