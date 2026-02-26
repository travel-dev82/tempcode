import { useState, useEffect } from 'react';
import { X, Search, Check, AlertTriangle, Loader2, CheckSquare, Square } from 'lucide-react';
import axiosInstance from '@/lib/axios';

export default function GroupSelector({ isOpen, onClose, onSelectGroups, selectedSession }) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [error, setError] = useState(null);

  // Fetch groups when the component is opened
  useEffect(() => {
    if (isOpen && selectedSession) {
      // Reset groups and error state before fetching
      setGroups([]);
      setError(null);
      setSelectedGroups([]); // Reset selections when opening
      fetchGroups();
    }
  }, [isOpen, selectedSession]);

  // Filter groups based on search term
  const filteredGroups = searchTerm
    ? (Array.isArray(groups) ? groups.filter(group => 
        (group.name && group.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (group.subject && group.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (group.id && group.id.toLowerCase().includes(searchTerm.toLowerCase()))
      ) : [])
    : (Array.isArray(groups) ? groups : []);

  // Handle select all filtered groups
  const handleSelectAll = () => {
    if (isAllFilteredSelected()) {
      // Deselect all filtered groups
      const filteredGroupIds = filteredGroups.map(g => g.id);
      setSelectedGroups(selectedGroups.filter(g => !filteredGroupIds.includes(g.id)));
    } else {
      // Select all filtered groups
      const newSelections = filteredGroups.filter(
        group => !selectedGroups.some(selected => selected.id === group.id)
      );
      setSelectedGroups([...selectedGroups, ...newSelections]);
    }
  };

  // Check if all filtered groups are selected
  const isAllFilteredSelected = () => {
    if (filteredGroups.length === 0) return false;
    return filteredGroups.every(group => 
      selectedGroups.some(selected => selected.id === group.id)
    );
  };

  // Check if some (but not all) filtered groups are selected
  const isSomeFilteredSelected = () => {
    if (filteredGroups.length === 0) return false;
    const selectedCount = filteredGroups.filter(group => 
      selectedGroups.some(selected => selected.id === group.id)
    ).length;
    return selectedCount > 0 && selectedCount < filteredGroups.length;
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Ctrl/Cmd + A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && filteredGroups.length > 0) {
        e.preventDefault();
        handleSelectAll();
      }
      // Escape to close
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredGroups, handleSelectAll, onClose]);

  // Fetch groups for selected session
  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Validate selectedSession
      if (!selectedSession) {
        throw new Error('No session selected');
      }

      const sessionId = parseInt(selectedSession);
      if (isNaN(sessionId)) {
        throw new Error('Invalid session ID');
      }

      const response = await axiosInstance.post('/api/baileys/get-groups', {
        sessionId: sessionId
      });
      
      if (response.data.success) {
        // Handle new API response format - groups are in response.data.data.groups
        let groupsData = [];
        
        if (response.data.data && response.data.data.groups) {
          groupsData = response.data.data.groups;
        } else if (response.data.message && Array.isArray(response.data.message)) {
          // Fallback for old format
          groupsData = response.data.message;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          // Another fallback
          groupsData = response.data.data;
        }
        
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      } else {
        setGroups([]);
        setError(response.data.message || 'Failed to load WhatsApp groups');
        
        // Check for device offline message
        if (response.data.error && 
            (response.data.error.message === "Device is offline" || 
             response.data.error.message.toLowerCase().includes('offline'))) {
          setError("This WhatsApp session appears to be offline. Please scan the QR code to reconnect.");
        }
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups([]);
      setError('Failed to load WhatsApp groups');
    } finally {
      setLoading(false);
    }
  };

  // Handle group selection
  const toggleGroupSelection = (group) => {
    if (selectedGroups.some(g => g.id === group.id)) {
      setSelectedGroups(selectedGroups.filter(g => g.id !== group.id));
    } else {
      setSelectedGroups([...selectedGroups, group]);
    }
  };

  // Handle adding selected groups to recipients
  const handleAddGroups = () => {
    // Return group IDs without the @g.us suffix
    const groupIds = selectedGroups.map(group => group.id.replace('@g.us', ''));
    onSelectGroups(groupIds);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="relative bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-[#E1E7EF]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[#E1E7EF] flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#121212]">Select WhatsApp Groups</h3>
          <button 
            onClick={onClose}
            className="text-[#737373] hover:text-[#121212] p-2 hover:bg-[#F8FAFB] rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="p-6 pt-4 border-b border-[#E1E7EF]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#737373]" />
            <input
              type="text"
              placeholder="Search groups by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent"
            />
          </div>
        </div>
        
        {/* Select All Controls */}
        {!loading && !error && filteredGroups.length > 0 && (
          <div className="px-6 py-3 border-b border-[#E1E7EF] bg-[#F8FAFB]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-sm text-[#737373] hover:text-[#121212] transition-colors"
                >
                  {isAllFilteredSelected() ? (
                    <CheckSquare className="h-4 w-4 text-[#2A7B6E]" />
                  ) : isSomeFilteredSelected() ? (
                    <div className="h-4 w-4 border-2 border-[#2A7B6E] bg-[#2A7B6E] rounded flex items-center justify-center">
                      <div className="h-2 w-2 bg-white rounded-sm"></div>
                    </div>
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  <span className="font-medium">
                    {isAllFilteredSelected() ? 'Deselect All' : 'Select All'}
                  </span>
                </button>
                                 <span className="text-xs text-[#737373]">
                   ({filteredGroups.filter(group => selectedGroups.some(s => s.id === group.id)).length} of {filteredGroups.length} selected)
                 </span>
                 <span className="text-xs text-[#A8A8A8] ml-2">
                   Press Ctrl+A to select all
                 </span>
              </div>
              
              {selectedGroups.length > 0 && (
                <button
                  onClick={() => setSelectedGroups([])}
                  className="text-xs text-red-600 hover:text-red-700 transition-colors"
                >
                  Clear All Selections
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Group List */}
        <div className="p-6 pt-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#2A7B6E]/20 border-t-[#2A7B6E]"></div>
              <span className="ml-3 text-[#737373]">Loading groups...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
              <p className="text-[#737373]">{error}</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#737373]">
                {searchTerm ? 'No groups match your search' : 'No groups found for this session'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {Array.isArray(filteredGroups) && filteredGroups.map((group) => {
                // Ensure group has required properties
                if (!group || !group.id) return null;
                
                return (
                  <div 
                    key={group.id}
                    onClick={() => toggleGroupSelection(group)}
                    className={`flex items-center p-4 rounded-lg cursor-pointer border transition-all duration-200 ${
                      selectedGroups.some(g => g.id === group.id)
                        ? 'bg-[#2A7B6E]/5 border-[#2A7B6E] shadow-sm ring-1 ring-[#2A7B6E]/20'
                        : 'bg-white border-[#E1E7EF] hover:border-[#2A7B6E] hover:shadow-sm hover:bg-[#F8FAFB]'
                    }`}
                  >
                    <div className="flex-1">
                      <h4 className="text-[#121212] font-medium">{group.subject || group.name || 'Unknown Group'}</h4>
                      <p className="text-xs text-[#737373] mt-1">
                        ID: {group.id} • {group.participants || group.contact_count || 0} members
                      </p>
                    </div>
                    <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                      selectedGroups.some(g => g.id === group.id)
                        ? 'bg-[#2A7B6E] border-[#2A7B6E] text-white'
                        : 'bg-white border-[#E1E7EF] hover:border-[#2A7B6E]'
                    }`}>
                      {selectedGroups.some(g => g.id === group.id) && (
                        <Check className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer with Actions */}
        <div className="p-6 pt-4 border-t border-[#E1E7EF] flex items-center justify-between">
          <div className="text-sm text-[#737373]">
            {selectedGroups.length > 0 ? (
              <div>
                <div className="font-medium text-[#121212]">
                  {selectedGroups.length} group{selectedGroups.length !== 1 ? 's' : ''} selected
                </div>
                <div className="text-xs text-[#737373] mt-1">
                  {selectedGroups.reduce((total, group) => total + (group.participants || 0), 0)} total members
                </div>
              </div>
            ) : (
              <span>No groups selected</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#E1E7EF] text-[#737373] rounded-lg hover:bg-[#F8FAFB] transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAddGroups}
              disabled={selectedGroups.length === 0}
              className={`px-4 py-2 bg-[#2A7B6E] text-white rounded-lg transition-colors font-medium ${
                selectedGroups.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#24695F]'
              }`}
            >
              {selectedGroups.length === 0 
                ? 'Select Groups' 
                : `Add ${selectedGroups.length} Group${selectedGroups.length !== 1 ? 's' : ''}`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}