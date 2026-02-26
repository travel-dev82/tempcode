import { useState, useEffect } from 'react';
import { ChevronDown, FileText, Image, Layout } from 'lucide-react';
import axiosInstance from '@/lib/axios';

export default function TemplateSelector({ onTemplateSelect, disabled = false, className = "" }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch templates on component mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/wa-templates');
      
      if (response.data.success && response.data.data) {
        // Filter only approved Cloud API templates and ensure proper structure
        const activeTemplates = response.data.data
          .filter(template => 
            template.status === 'APPROVED'
          )
          .map(template => {
            // Ensure template has necessary structure to prevent errors
            if (!template.temp_data) {
              template.temp_data = {};
            }
            return template;
          });
        
        setTemplates(activeTemplates);
      } else {
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error fetching cloud templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template) => {
    // Ensure template has the necessary structure to prevent errors
    if (template && !template.temp_data) {
      template.temp_data = {};
    }
    
    // Process the template before passing it to parent
    const processedTemplate = {...template};
    
    // Extract the actual body text if it's in the nested format
    if (processedTemplate.temp_data && processedTemplate.temp_data.body && 
        typeof processedTemplate.temp_data.body !== 'string' && 
        processedTemplate.temp_data.body.text) {
      // Keep the original structure but also add a processed bodyText property for easier access
      processedTemplate.bodyText = processedTemplate.temp_data.body.text;
    }
    
    setSelectedTemplate(processedTemplate);
    setDropdownOpen(false);
    onTemplateSelect(processedTemplate);
  };

  const handleClearSelection = () => {
    setSelectedTemplate(null);
    onTemplateSelect(null);
  };

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-[#121212] mb-2 flex items-center">
        <Layout className="h-4 w-4 mr-2" />
        Select Template
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={disabled || loading}
          className="w-full bg-white border border-[#E1E7EF] rounded-lg px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {loading ? (
                <span className="text-[#737373]">Loading templates...</span>
              ) : selectedTemplate ? (
                <div className="flex items-center">
                  {!selectedTemplate.temp_data?.header || selectedTemplate.temp_data?.header?.type === 'TEXT' ? (
                    <FileText className="h-4 w-4 mr-2 text-[#2A7B6E]" />
                  ) : (
                    <Image className="h-4 w-4 mr-2 text-[#2A7B6E]" />
                  )}
                  <span className="text-[#121212]">{selectedTemplate.template_name}</span>
                  <span className="ml-2 px-2 py-0.5 bg-[#2A7B6E]/10 text-[#2A7B6E] text-xs rounded-full">
                    {selectedTemplate.temp_data?.header?.type || 'TEXT'}
                  </span>
                </div>
              ) : (
                <span className="text-[#737373]">Choose a template (required)</span>
              )}
            </div>
            <ChevronDown className={`h-4 w-4 text-[#737373] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {dropdownOpen && !loading && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-[#E1E7EF] rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {/* Clear Selection Option */}
            <button
              type="button"
              onClick={handleClearSelection}
              className="w-full px-4 py-3 text-left hover:bg-[#F8FAFB] border-b border-[#E1E7EF] text-[#737373] text-sm"
            >
              Clear selection
            </button>
            
            {templates.length === 0 ? (
              <div className="px-4 py-3 text-[#737373] text-center">
                <Layout className="h-8 w-8 mx-auto mb-2 text-[#E1E7EF]" />
                <p>No templates available</p>
                <p className="text-xs mt-1">Create templates to use them here</p>
              </div>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className="w-full px-4 py-3 text-left hover:bg-[#F8FAFB] border-b border-[#E1E7EF] last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {!template.temp_data?.header || template.temp_data?.header?.type === 'TEXT' ? (
                        <FileText className="h-4 w-4 mr-3 text-[#2A7B6E]" />
                      ) : (
                        <Image className="h-4 w-4 mr-3 text-[#2A7B6E]" />
                      )}
                      <div>
                        <div className="font-medium text-[#121212]">{template.template_name}</div>
                        {template.temp_data && template.temp_data.body ? (
                          <div className="text-xs text-[#737373] mt-1 truncate max-w-xs">
                            {typeof template.temp_data.body === 'string' 
                              ? template.temp_data.body.substring(0, 100) 
                              : template.temp_data.body.text 
                                ? template.temp_data.body.text.substring(0, 100)
                                : 'No body text'
                            }
                            {(typeof template.temp_data.body === 'string' 
                              ? template.temp_data.body.length > 100
                              : template.temp_data.body.text && template.temp_data.body.text.length > 100) && '...'}
                          </div>
                        ) : (
                          <div className="text-xs text-[#737373] mt-1">
                            No body content
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-[#2A7B6E]/10 text-[#2A7B6E] text-xs rounded-full ml-2">
                      {template.temp_data?.header?.type || 'TEXT'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Template Preview */}
      {selectedTemplate && (
        <div className="mt-3 p-3 bg-[#F8FAFB] border border-[#E1E7EF] rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <span className="text-xs font-medium text-[#737373]">SELECTED TEMPLATE</span>
            </div>
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs text-[#2A7B6E] hover:text-[#24695F]"
            >
              Clear
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="text-sm font-medium text-[#121212]">{selectedTemplate.template_name}</span>
              <span className="ml-2 px-2 py-0.5 bg-white border border-[#E1E7EF] text-[#2A7B6E] text-xs rounded-full">
                {selectedTemplate.category || 'UTILITY'}
              </span>
            </div>
            
            {selectedTemplate.temp_data && selectedTemplate.temp_data.body ? (
              <div className="text-sm text-[#737373] bg-white p-2 rounded border border-[#E1E7EF]">
                {typeof selectedTemplate.temp_data.body === 'string' 
                  ? selectedTemplate.temp_data.body 
                  : selectedTemplate.temp_data.body.text || 'No body text'
                }
              </div>
            ) : (
              <div className="text-sm text-[#737373] bg-white p-2 rounded border border-[#E1E7EF]">
                No body content available
              </div>
            )}
            
            {selectedTemplate.temp_data && selectedTemplate.temp_data.header && selectedTemplate.temp_data.header.type !== 'TEXT' && (
              <div className="text-xs text-[#737373] flex items-center">
                <Image className="h-3 w-3 mr-1" />
                {selectedTemplate.temp_data.header.type} header attached
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 