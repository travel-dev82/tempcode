'use client';

import { memo, useState } from 'react';
import { 
  Check, CheckCheck, Clock, AlertCircle, Image, FileText, 
  MapPin, User, Phone, Video, Mic, File, X, Download,
  Play, Pause, Volume2
} from 'lucide-react';

// Format time helper
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// Get file extension icon
const getFileIcon = (filename, mimeType) => {
  const ext = filename?.split('.').pop()?.toLowerCase();
  if (mimeType?.includes('pdf')) return { icon: '📄', color: '#E74C3C' };
  if (mimeType?.includes('word') || ext === 'doc' || ext === 'docx') return { icon: '📝', color: '#3498DB' };
  if (mimeType?.includes('excel') || ext === 'xls' || ext === 'xlsx') return { icon: '📊', color: '#27AE60' };
  if (mimeType?.includes('powerpoint') || ext === 'ppt' || ext === 'pptx') return { icon: '📋', color: '#E67E22' };
  if (mimeType?.includes('zip') || ext === 'zip' || ext === 'rar') return { icon: '🗜️', color: '#9B59B6' };
  return { icon: '📄', color: '#667781' };
};

// Status icon component
const StatusIcon = memo(function StatusIcon({ status }) {
  switch (status) {
    case 'pending':
      return <Clock className="w-3.5 h-3.5 text-[#8696A0]" />;
    case 'sent':
      return <Check className="w-3.5 h-3.5 text-[#8696A0]" />;
    case 'delivered':
      return <CheckCheck className="w-3.5 h-3.5 text-[#8696A0]" />;
    case 'read':
      return <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />;
    case 'failed':
      return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
    default:
      return null;
  }
});

// Image message component
const ImageMessage = memo(function ImageMessage({ mediaUrl, caption }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  return (
    <div className="max-w-[280px]">
      <div className="relative rounded-lg overflow-hidden bg-black/5 min-h-[120px]">
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#00A884] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error ? (
          <div className="flex items-center justify-center h-32 bg-[#E9EDEF]">
            <Image className="w-8 h-8 text-[#8696A0]" />
          </div>
        ) : (
          <img 
            src={mediaUrl} 
            alt={caption || 'Image'}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            className={`w-full max-h-[300px] object-cover ${!loaded ? 'opacity-0' : ''}`}
          />
        )}
      </div>
      {caption && (
        <p className="mt-1 text-sm whitespace-pre-wrap">{caption}</p>
      )}
    </div>
  );
});

// Video message component
const VideoMessage = memo(function VideoMessage({ mediaUrl, caption }) {
  const [playing, setPlaying] = useState(false);
  
  return (
    <div className="max-w-[280px]">
      <div className="relative rounded-lg overflow-hidden bg-black min-h-[150px]">
        <video 
          src={mediaUrl}
          controls
          className="w-full max-h-[300px]"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      </div>
      {caption && (
        <p className="mt-1 text-sm whitespace-pre-wrap">{caption}</p>
      )}
    </div>
  );
});

// Audio message component
const AudioMessage = memo(function AudioMessage({ mediaUrl }) {
  return (
    <div className="min-w-[200px] max-w-[280px]">
      <audio 
        src={mediaUrl} 
        controls 
        className="w-full h-10"
      />
    </div>
  );
});

// Document message component
const DocumentMessage = memo(function DocumentMessage({ mediaUrl, filename, mimeType }) {
  const { icon, color } = getFileIcon(filename, mimeType);
  
  return (
    <a 
      href={mediaUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 bg-black/5 rounded-lg min-w-[200px] max-w-[280px] hover:bg-black/10 transition-colors"
    >
      <div 
        className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
        style={{ backgroundColor: `${color}20` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{filename || 'Document'}</p>
        <p className="text-xs text-[#8696A0]">
          {mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
        </p>
      </div>
      <Download className="w-5 h-5 text-[#8696A0] flex-shrink-0" />
    </a>
  );
});

// Location message component
const LocationMessage = memo(function LocationMessage({ locationData }) {
  const { latitude, longitude, name, address } = locationData || {};
  
  if (!latitude || !longitude) return null;
  
  const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
  
  return (
    <a 
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block max-w-[280px] rounded-lg overflow-hidden"
    >
      <div className="h-32 bg-[#E9EDEF] flex items-center justify-center">
        <MapPin className="w-8 h-8 text-[#00A884]" />
      </div>
      <div className="p-2 bg-black/5">
        {name && <p className="text-sm font-medium truncate">{name}</p>}
        {address && <p className="text-xs text-[#8696A0] truncate">{address}</p>}
      </div>
    </a>
  );
});

// Contact message component
const ContactMessage = memo(function ContactMessage({ contactData }) {
  if (!contactData || !Array.isArray(contactData) || contactData.length === 0) return null;
  
  const contact = contactData[0];
  const { name, phones } = contact || {};
  
  return (
    <div className="min-w-[200px] max-w-[280px] p-3 bg-black/5 rounded-lg">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-[#00A884] flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        <p className="font-medium">{name?.formatted_name || 'Contact'}</p>
      </div>
      {phones?.length > 0 && (
        <div className="space-y-1">
          {phones.slice(0, 2).map((phone, i) => (
            <p key={i} className="text-sm text-[#00A884] flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {phone.phone}
            </p>
          ))}
        </div>
      )}
    </div>
  );
});

// WhatsApp text formatting
const formatWhatsAppText = (text) => {
  if (!text) return text;
  
  // Bold: *text*
  text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  // Italic: _text_
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Strikethrough: ~text~
  text = text.replace(/~([^~]+)~/g, '<del>$1</del>');
  // Monospace: ```text```
  text = text.replace(/```([^`]+)```/g, '<code class="bg-black/10 px-1 rounded">$1</code>');
  
  return text;
};

// Text message component
const TextMessage = memo(function TextMessage({ content }) {
  return (
    <p 
      className="text-[15px] leading-[19px] whitespace-pre-wrap break-words"
      dangerouslySetInnerHTML={{ __html: formatWhatsAppText(content) }}
    />
  );
});

// Main MessageBubble component
const MessageBubble = memo(function MessageBubble({ 
  message, 
  isOwn,
  showTail = true,
  onMediaClick 
}) {
  const [showMenu, setShowMenu] = useState(false);
  
  const {
    message_content: content,
    message_type: type,
    media_url: mediaUrl,
    media_filename: filename,
    media_caption: caption,
    media_mime_type: mimeType,
    location_data: locationData,
    contact_data: contactData,
    timestamp,
    status,
    direction
  } = message;
  
  const isOutbound = direction === 'outbound' || isOwn;
  const time = formatTime(timestamp);
  
  // Render message content based on type
  const renderContent = () => {
    switch (type) {
      case 'image':
        return <ImageMessage mediaUrl={mediaUrl} caption={caption} />;
      case 'video':
        return <VideoMessage mediaUrl={mediaUrl} caption={caption} />;
      case 'audio':
        return <AudioMessage mediaUrl={mediaUrl} />;
      case 'document':
        return <DocumentMessage mediaUrl={mediaUrl} filename={filename} mimeType={mimeType} />;
      case 'location':
        return <LocationMessage locationData={locationData} />;
      case 'contacts':
      case 'contact':
        return <ContactMessage contactData={contactData} />;
      default:
        return <TextMessage content={content} />;
    }
  };
  
  return (
    <div 
      className={`flex flex-col max-w-[65%] ${
        isOutbound ? 'items-end' : 'items-start'
      }`}
    >
      <div 
        className={`relative px-3 py-2 rounded-lg shadow-sm ${
          isOutbound 
            ? 'bg-[#D9FDD3]' 
            : 'bg-white'
        }`}
        style={{
          // Message tail effect using pseudo-element style
          ...(isOutbound && {
            borderTopRightRadius: 0,
          }),
          ...(!isOutbound && {
            borderTopLeftRadius: 0,
          })
        }}
      >
        {renderContent()}
        
        {/* Time and Status */}
        <div className={`flex items-center justify-end gap-1 mt-1 ${type !== 'text' && !content ? '-mt-1' : ''}`}>
          <span className="text-[11px] text-[#8696A0]">
            {time}
          </span>
          {isOutbound && <StatusIcon status={status} />}
        </div>
      </div>
    </div>
  );
});

export default MessageBubble;
