import { useState, useEffect, useRef } from 'react';
import { X, Search, Filter, Image as ImageIcon, FileText, Video, Loader2, Upload } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import Swal from 'sweetalert2';
import { ACCEPT_STRING, validateFiles, humanizeErrors, createPreviewURLs, revokePreviewURLs } from '@/lib/uploadValidation';

export default function MediaSelector({ isOpen, onClose, onSelect }) {
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [previews, setPreviews] = useState([]);
  const previewsRef = useRef([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
    hasPrevPage: false,
    hasNextPage: false
  });

  // Fetch media on component mount
  useEffect(() => {
    if (isOpen) {
      fetchMedia();
    }
  }, [isOpen]);

  // Fetch media data
  const fetchMedia = async (page = 1, limit = 12, search = '', type = 'all') => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/api/media', {
        params: {
          page,
          limit,
          search,
          type
        }
      });

      if (response.data.success) {
        setMedia(response.data.data.media);
        setPagination({
          page: response.data.data.page,
          limit: response.data.data.limit,
          total: response.data.data.total,
          totalPages: response.data.data.totalPages,
          hasPrevPage: response.data.data.hasPrevPage,
          hasNextPage: response.data.data.hasNextPage
        });
      } else {
        throw new Error(response.data.message || 'Failed to fetch media');
      }
    } catch (error) {
      console.error('Error fetching media:', error);
      setMedia([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchMedia(1, pagination.limit, searchQuery, typeFilter);
  };

  // Handle type filter change
  const handleTypeFilterChange = (e) => {
    const newType = e.target.value;
    setTypeFilter(newType);
    fetchMedia(1, pagination.limit, searchQuery, newType);
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    fetchMedia(newPage, pagination.limit, searchQuery, typeFilter);
  };

  // Toggle upload form
  const toggleUploadForm = () => {
    setShowUploadForm(!showUploadForm);
    setUploadFiles([]);
    setUploadProgress(0);
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    const combined = [...uploadFiles, ...selectedFiles];
    const { validFiles, errors } = validateFiles(combined);
    if (errors.length) {
      Swal.fire({
        title: 'Invalid files',
        text: humanizeErrors(errors),
        icon: 'error',
        background: '#FFFFFF',
        color: '#121212',
        customClass: {
          popup: 'rounded-xl border border-[#E1E7EF]',
          confirmButton: 'px-4 py-2 bg-[#2A7B6E] text-white rounded-lg hover:bg-[#24695F] transition-colors duration-200'
        }
      });
    }
    setUploadFiles(validFiles);
  };

  // Remove file from selection
  const removeFile = (index) => {
    setUploadFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  // Manage previews and cleanup
  useEffect(() => {
    revokePreviewURLs(previewsRef.current);
    const next = createPreviewURLs(uploadFiles.filter(file => file.type.startsWith('image/')));
    previewsRef.current = next;
    setPreviews(next);
    return () => revokePreviewURLs(next);
  }, [uploadFiles]);

  // Handle upload
  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      Swal.fire({
        title: 'No files selected',
        text: 'Please select at least one file to upload',
        icon: 'warning',
        background: '#FFFFFF',
        color: '#121212',
        customClass: {
          popup: 'rounded-xl border border-[#E1E7EF]',
          confirmButton: 'px-4 py-2 bg-[#2A7B6E] text-white rounded-lg hover:bg-[#24695F] transition-colors duration-200'
        }
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    try {
      // Create FormData
      const formData = new FormData();
      uploadFiles.forEach(file => {
        formData.append('files', file);
      });
      
      // Upload files
      const response = await axiosInstance.post('/api/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });
      
      if (response.data.success) {
        Swal.fire({
          title: 'Upload successful',
          text: `${uploadFiles.length} file(s) uploaded successfully`,
          icon: 'success',
          background: '#FFFFFF',
          color: '#121212',
          customClass: {
            popup: 'rounded-xl border border-[#E1E7EF]',
            confirmButton: 'px-4 py-2 bg-[#2A7B6E] text-white rounded-lg hover:bg-[#24695F] transition-colors duration-200'
          }
        });
        
        // Reset state
        setUploadFiles([]);
        setShowUploadForm(false);
        
        // Refresh media list and select the newly uploaded media
        const mediaResponse = await axiosInstance.get('/api/media', {
          params: {
            page: 1,
            limit: 1
          }
        });
        
        if (mediaResponse.data.success && mediaResponse.data.data.media && mediaResponse.data.data.media.length > 0) {
          // If there's only one uploaded file, automatically select it
          if (uploadFiles.length === 1) {
            onSelect(mediaResponse.data.data.media[0]);
          } else {
            // Otherwise just refresh the list
            fetchMedia(1, pagination.limit, searchQuery, typeFilter);
          }
        }
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Swal.fire({
        title: 'Upload failed',
        text: error.response?.data?.message || error.message || 'An error occurred during upload',
        icon: 'error',
        background: '#FFFFFF',
        color: '#121212',
        customClass: {
          popup: 'rounded-xl border border-[#E1E7EF]',
          confirmButton: 'px-4 py-2 bg-[#2A7B6E] text-white rounded-lg hover:bg-[#24695F] transition-colors duration-200'
        }
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Get file icon based on file type
  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4 text-blue-600" />;
    } else if (fileType?.startsWith('video/')) {
      return <Video className="h-4 w-4 text-purple-600" />;
    } else {
      return <FileText className="h-4 w-4 text-amber-600" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="relative bg-white rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col border border-[#E1E7EF]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 p-6 pb-3 border-b border-[#E1E7EF] flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#121212]">
            {showUploadForm ? 'Upload New Media' : 'Select Media'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleUploadForm}
              className={`flex items-center gap-1 px-3 py-1.5 ${
                showUploadForm 
                  ? 'bg-[#F8FAFB] border border-[#E1E7EF] hover:bg-[#E1E7EF] text-[#737373]' 
                  : 'bg-[#2A7B6E] hover:bg-[#24695F] text-white'
              } rounded-lg transition-colors text-sm font-medium`}
            >
              {showUploadForm ? (
                <>Back to Media</>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload New
                </>
              )}
            </button>
            <button 
              onClick={onClose}
              className="text-[#737373] hover:text-[#121212] p-2 hover:bg-[#F8FAFB] rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {showUploadForm ? (
          /* Upload Form */
          <div className="flex-1 overflow-y-auto p-6 pt-4">
            {/* Upload Area */}
            <div 
              className="border-2 border-dashed border-[#E1E7EF] rounded-lg p-8 text-center hover:border-[#2A7B6E] transition-colors cursor-pointer mb-6"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                accept={ACCEPT_STRING}
                className="hidden"
                disabled={uploading}
              />
              <div className="w-16 h-16 bg-[#F8FAFB] border border-[#E1E7EF] rounded-full flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="h-8 w-8 text-[#737373]" />
              </div>
              <p className="text-[#121212] mb-2">
                <span className="font-medium text-[#2A7B6E]">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-[#737373]">
                Supported file types: Images, Videos, Documents
              </p>
            </div>
            
            {/* Selected Files */}
            {uploadFiles.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-[#121212] mb-3">Selected Files ({uploadFiles.length})</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {uploadFiles.map((file, index) => (
                    <div key={index} className="flex items-center bg-[#F8FAFB] rounded-lg p-3 border border-[#E1E7EF]">
                      {previews.find(p => p.fileName === file.name) ? (
                        <img 
                          src={previews.find(p => p.fileName === file.name)?.url} 
                          alt={file.name}
                          className="h-10 w-10 rounded object-cover mr-3" 
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-white border border-[#E1E7EF] flex items-center justify-center mr-3">
                          <Upload className="h-5 w-5 text-[#737373]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#121212] truncate font-medium">{file.name}</p>
                        <p className="text-xs text-[#737373]">
                          {(file.size / 1024).toFixed(2)} KB • {file.type || 'Unknown type'}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Upload Progress */}
            {uploading && (
              <div className="mb-6">
                <div className="flex justify-between text-xs text-[#737373] mb-2">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-[#E1E7EF] rounded-full h-2">
                  <div 
                    className="bg-[#2A7B6E] h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {/* Upload Button */}
            <div className="flex justify-end">
              <button
                onClick={handleUpload}
                className="px-4 py-2 rounded-lg bg-[#2A7B6E] text-white hover:bg-[#24695F] transition-colors flex items-center gap-2 disabled:opacity-50 font-medium"
                disabled={uploading || uploadFiles.length === 0}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Search and Filters */}
            <div className="p-6 pt-4 border-b border-[#E1E7EF] flex flex-col sm:flex-row gap-3">
              <form 
                onSubmit={handleSearch}
                className="relative flex-1"
              >
                <input
                  type="text"
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-3 pl-10 pr-4 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent"
                />
                <button 
                  type="submit"
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#737373]"
                >
                  <Search className="h-4 w-4" />
                </button>
              </form>

              <div className="relative w-full sm:w-auto">
                <select
                  value={typeFilter}
                  onChange={handleTypeFilterChange}
                  className="w-full sm:w-auto appearance-none py-3 pl-10 pr-8 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                  <option value="document">Documents</option>
                </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#737373]">
                  <Filter className="h-4 w-4" />
                </div>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#737373] pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Media Grid */}
            <div className="p-6 pt-4 overflow-y-auto flex-1">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#2A7B6E]/20 border-t-[#2A7B6E]"></div>
                    <p className="text-[#737373] mt-4">Loading media...</p>
                  </div>
                </div>
              ) : media.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E1E7EF] p-8 text-center">
                  <div className="w-16 h-16 bg-[#F8FAFB] border border-[#E1E7EF] rounded-full flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="h-8 w-8 text-[#737373]" />
                  </div>
                  <h3 className="text-lg font-medium text-[#121212] mb-2">No media found</h3>
                  <p className="text-sm text-[#737373] mb-6">
                    Upload some media files first to use in your messages
                  </p>
                  <button
                    onClick={toggleUploadForm}
                    className="px-4 py-2 bg-[#2A7B6E] text-white rounded-lg hover:bg-[#24695F] transition-colors flex items-center mx-auto gap-2 font-medium"
                  >
                    <Upload className="h-4 w-4" />
                    Upload New Media
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {media.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-white rounded-lg border border-[#E1E7EF] overflow-hidden cursor-pointer hover:border-[#2A7B6E] hover:shadow-lg transition-all duration-200"
                      onClick={() => onSelect(item)}
                    >
                      <div className="aspect-square relative">
                        {item.file_type?.startsWith('image/') ? (
                          <img
                            src={item.url}
                            alt={item.file_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="w-full h-full flex items-center justify-center bg-[#F8FAFB]" style={{ display: item.file_type?.startsWith('image/') ? 'none' : 'flex' }}>
                          {item.file_type?.startsWith('video/') ? (
                            <Video className="h-12 w-12 text-[#737373]" />
                          ) : (
                            <FileText className="h-12 w-12 text-[#737373]" />
                          )}
                        </div>
                      </div>
                      
                      <div className="p-3">
                        <div className="flex items-center">
                          {getFileIcon(item.file_type)}
                          <h3 className="ml-2 text-xs font-medium text-[#121212] truncate" title={item.file_name}>
                            {item.file_name}
                          </h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Pagination */}
            {!loading && pagination.total > 0 && (
              <div className="p-6 pt-4 border-t border-[#E1E7EF] flex flex-col sm:flex-row items-center justify-between text-sm text-[#737373]">
                <div className="mb-4 sm:mb-0 text-center sm:text-left">
                  Showing {pagination.total > 0 ? ((pagination.page - 1) * pagination.limit) + 1 : 0} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={!pagination.hasPrevPage}
                    className="px-3 py-1 border border-[#E1E7EF] bg-white rounded-lg hover:bg-[#F8FAFB] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    ««
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="px-3 py-1 border border-[#E1E7EF] bg-white rounded-lg hover:bg-[#F8FAFB] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    ‹
                  </button>
                  <div className="px-3 py-1 border border-[#E1E7EF] bg-white rounded-lg text-sm">
                    Page <span className="font-medium text-[#121212]">{pagination.page}</span> of <span className="font-medium text-[#121212]">{pagination.totalPages || 1}</span>
                  </div>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                    className="px-3 py-1 border border-[#E1E7EF] bg-white rounded-lg hover:bg-[#F8FAFB] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.totalPages)}
                    disabled={!pagination.hasNextPage}
                    className="px-3 py-1 border border-[#E1E7EF] bg-white rounded-lg hover:bg-[#F8FAFB] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    »»
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 