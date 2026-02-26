import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Loader2, Users, Calendar, User, UserPlus, MapPin, Hash, Cake, Heart, Building } from 'lucide-react';

export default function MessageForm({ onSendMessage, onAttachMedia, sending, values, onFormChange, isCampaign = false, hideRecipientField = false }) {
  const messageTextareaRef = useRef(null);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    onFormChange({
      ...values,
      [name]: value
    });
  };
  
  // Insert personalization placeholder at cursor position
  const insertPersonalization = (placeholder) => {
    const textarea = messageTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentMessage = values.messageText || '';
    
    // Insert the placeholder at cursor position
    const newMessage = currentMessage.substring(0, start) + placeholder + currentMessage.substring(end);
    
    // Update the form values
    onFormChange({
      ...values,
      messageText: newMessage
    });

    // Set cursor position after the inserted placeholder
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    onSendMessage();
    // Do not reset form values - keep everything until page reload
  };

  return (
    <div className="bg-white rounded-xl border border-[#E1E7EF] p-6">
      <h3 className="text-[#121212] font-medium mb-4 flex items-center">
        {isCampaign ? (
          <>
            <Calendar className="h-5 w-5 mr-2 text-purple-600" />
            Create Campaign Message
          </>
        ) : (
          <>Send WhatsApp Message</>
        )}
      </h3>
      
      <form onSubmit={handleSubmit}>
        {/* Recipient Field - hide when hideRecipientField is true */}
        {!hideRecipientField && (
          <div className="mb-4">
            <label htmlFor="receiverIds" className="block text-sm font-medium text-[#121212] mb-2 flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Recipient Phone Number(s)
              {isCampaign && <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full border border-purple-200">Campaign</span>}
            </label>
            <textarea
              id="receiverIds"
              name="receiverIds"
              value={values.receiverIds}
              onChange={handleChange}
              placeholder="e.g. +1234567890, +9198765432"
              rows={3}
              className="w-full py-3 px-4 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent resize-y"
              disabled={sending}
            />
            <p className="mt-1 text-xs text-[#737373]">
              Enter phone numbers with country code or WhatsApp group IDs. Separate multiple entries with commas.
            </p>
          </div>
        )}
        
        {/* Message Text Field */}
        <div className="mb-4">
          <label htmlFor="messageText" className="block text-sm font-medium text-[#121212] mb-2">
            Message
          </label>
          <textarea
            ref={messageTextareaRef}
            id="messageText"
            name="messageText"
            value={values.messageText}
            onChange={handleChange}
            rows={5}
            placeholder="Type your message here..."
            className="w-full py-3 px-4 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent resize-none"
            disabled={sending}
          />
          
          {/* Message Personalization Buttons */}
          <div className="mt-3 space-y-3">
            {/* Personal Information */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-[#737373] font-medium">Personal Info:</span>
              <button
                type="button"
                onClick={() => insertPersonalization('<first_name>')}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                disabled={sending}
              >
                <User className="h-3 w-3 mr-1" />
                First Name
              </button>
              <button
                type="button"
                onClick={() => insertPersonalization('<last_name>')}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                disabled={sending}
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Last Name
              </button>
            </div>

            {/* Important Dates */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-[#737373] font-medium">Important Dates:</span>
              <button
                type="button"
                onClick={() => insertPersonalization('<birthday_date>')}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-pink-50 text-pink-600 border border-pink-200 rounded-lg hover:bg-pink-100 transition-colors"
                disabled={sending}
              >
                <Cake className="h-3 w-3 mr-1" />
                Birthday
              </button>
              <button
                type="button"
                onClick={() => insertPersonalization('<anniversary_date>')}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                disabled={sending}
              >
                <Heart className="h-3 w-3 mr-1" />
                Anniversary
              </button>
            </div>

            {/* Contact Information */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-[#737373] font-medium">Contact Info:</span>
              <button
                type="button"
                onClick={() => insertPersonalization('<address>')}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                disabled={sending}
              >
                <MapPin className="h-3 w-3 mr-1" />
                Address
              </button>
            </div>

            {/* Custom Values */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-[#737373] font-medium">Custom Fields:</span>
              <button
                type="button"
                onClick={() => insertPersonalization('<value1>')}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                disabled={sending}
              >
                <Hash className="h-3 w-3 mr-1" />
                Value 1
              </button>
              <button
                type="button"
                onClick={() => insertPersonalization('<value2>')}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                disabled={sending}
              >
                <Hash className="h-3 w-3 mr-1" />
                Value 2
              </button>
              <button
                type="button"
                onClick={() => insertPersonalization('<value3>')}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                disabled={sending}
              >
                <Hash className="h-3 w-3 mr-1" />
                Value 3
              </button>
              <button
                type="button"
                onClick={() => insertPersonalization('<value4>')}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                disabled={sending}
              >
                <Hash className="h-3 w-3 mr-1" />
                Value 4
              </button>
              <button
                type="button"
                onClick={() => insertPersonalization('<value5>')}
                className="inline-flex items-center px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                disabled={sending}
              >
                <Hash className="h-3 w-3 mr-1" />
                Value 5
              </button>
            </div>
          </div>
          
          {/* Help text for personalization */}
          <p className="mt-2 text-xs text-[#737373]">
            Use personalization tags to customize messages for each contact. Click the buttons above to insert placeholders. 
            Tags will be replaced with actual contact data when the campaign is sent.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6">
          <button
            type="button"
            onClick={onAttachMedia}
            className="px-4 py-2 bg-white border border-[#E1E7EF] text-[#737373] rounded-lg hover:bg-[#F8FAFB] hover:border-[#2A7B6E] transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-auto font-medium"
            disabled={sending}
          >
            <Paperclip className="h-4 w-4" />
            Attach Media
          </button>
          
          <button
            type="submit"
            className={`px-4 py-2 ${isCampaign ? 'bg-purple-600 hover:bg-purple-700' : 'bg-[#2A7B6E] hover:bg-[#24695F]'} text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 font-medium`}
            disabled={sending}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isCampaign ? 'Creating Campaign...' : 'Sending...'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {isCampaign ? 'Create Campaign' : 'Send Message'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 