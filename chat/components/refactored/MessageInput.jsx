'use client';

import { useState, useRef, useCallback, memo } from 'react';
import { 
  Send, Paperclip, Smile, Image, FileText, Mic, X, 
  MoreVertical, ChevronDown
} from 'lucide-react';

// Emoji picker data (common emojis)
const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋'],
  'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🖐️', '✋', '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💪', '🦾'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Objects': ['📱', '💻', '⌨️', '🖥️', '🖨️', '📞', '📠', '📺', '📻', '📷', '📹', '🎥', '📽️', '🎬', '📧', '📨', '📩', '💬']
};

// File type detection
const getFileType = (file) => {
  const type = file.type;
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type === 'application/pdf') return 'pdf';
  return 'document';
};

// Attachment preview component
const AttachmentPreview = memo(function AttachmentPreview({ attachment, onRemove }) {
  const { file, type, preview } = attachment;
  
  if (type === 'image' && preview) {
    return (
      <div className="relative group">
        <img 
          src={preview} 
          alt="Preview"
          className="w-16 h-16 object-cover rounded-lg border border-[#E9EDEF]"
        />
        <button
          onClick={() => onRemove()}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }
  
  return (
    <div className="relative group flex items-center gap-2 px-3 py-2 bg-[#F0F2F5] rounded-lg">
      <FileText className="w-4 h-4 text-[#54656F]" />
      <span className="text-xs text-[#54656F] max-w-[80px] truncate">
        {file.name}
      </span>
      <button
        onClick={() => onRemove()}
        className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
});

// Emoji picker component
const EmojiPicker = memo(function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState('Smileys');
  
  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg shadow-lg border border-[#E9EDEF] overflow-hidden z-50">
      {/* Category tabs */}
      <div className="flex border-b border-[#E9EDEF]">
        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeCategory === cat 
                ? 'text-[#00A884] bg-[#F0F2F5]' 
                : 'text-[#54656F] hover:bg-[#F0F2F5]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      
      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-1 p-2 max-h-48 overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory].map((emoji, i) => (
          <button
            key={i}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-7 h-7 flex items-center justify-center hover:bg-[#F0F2F5] rounded text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
});

// Main MessageInput component
export default function MessageInput({
  onSendMessage,
  onAttachMedia,
  disabled = false,
  placeholder = "Type a message..."
}) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Handle send message
  const handleSend = useCallback(() => {
    if (disabled) return;
    if (!message.trim() && attachments.length === 0) return;
    
    onSendMessage?.({
      text: message.trim(),
      attachments: attachments.map(a => ({
        file: a.file,
        type: a.type
      }))
    });
    
    setMessage('');
    setAttachments([]);
    
    // Reset textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, attachments, disabled, onSendMessage]);
  
  // Handle key press
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);
  
  // Handle text change
  const handleTextChange = useCallback((e) => {
    setMessage(e.target.value);
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, []);
  
  // Handle file select
  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = files.map(file => ({
      file,
      type: getFileType(file),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));
    
    setAttachments(prev => [...prev, ...newAttachments]);
    onAttachMedia?.(newAttachments);
    setShowAttachMenu(false);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onAttachMedia]);
  
  // Remove attachment
  const removeAttachment = useCallback((index) => {
    setAttachments(prev => {
      const attachment = prev[index];
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);
  
  // Insert emoji
  const insertEmoji = useCallback((emoji) => {
    setMessage(prev => prev + emoji);
    textareaRef.current?.focus();
  }, []);
  
  return (
    <div className="bg-[#F0F2F5] px-4 py-3 border-t border-[#E9EDEF]">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((attachment, index) => (
            <AttachmentPreview
              key={index}
              attachment={attachment}
              onRemove={() => removeAttachment(index)}
            />
          ))}
        </div>
      )}
      
      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Emoji button */}
        <div className="relative">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            disabled={disabled}
            className="w-10 h-10 flex items-center justify-center text-[#54656F] hover:text-[#111B21] transition-colors disabled:opacity-50"
          >
            <Smile className="w-6 h-6" />
          </button>
          
          {showEmoji && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowEmoji(false)} 
              />
              <EmojiPicker 
                onSelect={insertEmoji}
                onClose={() => setShowEmoji(false)}
              />
            </>
          )}
        </div>
        
        {/* Attachment button */}
        <div className="relative">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            disabled={disabled}
            className="w-10 h-10 flex items-center justify-center text-[#54656F] hover:text-[#111B21] transition-colors disabled:opacity-50"
          >
            <Paperclip className="w-6 h-6" />
          </button>
          
          {showAttachMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowAttachMenu(false)} 
              />
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-lg shadow-lg border border-[#E9EDEF] overflow-hidden z-50">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] transition-colors text-left"
                >
                  <Image className="w-5 h-5 text-[#00A884]" />
                  <span className="text-sm text-[#111B21]">Photo & Video</span>
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F0F2F5] transition-colors text-left"
                >
                  <FileText className="w-5 h-5 text-[#54656F]" />
                  <span className="text-sm text-[#111B21]">Document</span>
                </button>
              </div>
            </>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
        
        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-2.5 bg-white rounded-lg resize-none focus:outline-none text-[#111B21] placeholder-[#8696A0] text-[15px] leading-normal disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
        </div>
        
        {/* Send / Mic button */}
        <button
          onClick={handleSend}
          disabled={disabled || (!message.trim() && attachments.length === 0)}
          className="w-10 h-10 flex items-center justify-center bg-[#00A884] text-white rounded-full hover:bg-[#06CF9C] transition-colors disabled:bg-[#D1D7DB] disabled:text-[#8696A0] disabled:cursor-not-allowed"
        >
          {message.trim() || attachments.length > 0 ? (
            <Send className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
