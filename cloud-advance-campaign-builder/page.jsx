'use client';

import { useState, useEffect } from 'react';
import {
  Send, Image as ImageIcon, Loader2, Calendar, UserPlus, X,
  ChevronRight, ChevronLeft, CheckCircle, Settings, Layout,
  Paperclip, MessageSquare, RotateCcw, AlertTriangle
} from 'lucide-react';
import axiosInstance from '@/lib/axios';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';

import MessageForm from './components/MessageForm';
import MediaSelector from './components/MediaSelector';
import TemplateSelector from './components/TemplateSelector';

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cloud_adv_campaign_draft';

const STEPS = [
  { id: 1, label: 'Campaign Settings', icon: Settings,       description: 'Name, schedule & audience' },
  { id: 2, label: 'Template',          icon: Layout,         description: 'Select WhatsApp template'  },
  { id: 3, label: 'Media',             icon: Paperclip,      description: 'Attach media (optional)'   },
  { id: 4, label: 'Message',           icon: MessageSquare,  description: 'Compose & create'          },
];

const DEFAULT_CAMPAIGN_DATA = {
  campaignName: '',
  scheduleTime: '',
  scheduleType: 'onetime',
  frequencyCycle: '',
  frequencyAmount: 1,
  frequencyUnit: 'day',
  recurringEnd: '',
  contactGroupIds: [],
};

const DEFAULT_DRAFT = {
  currentStep: 1,
  campaignData: DEFAULT_CAMPAIGN_DATA,
  selectedTemplate: null,
  selectedMedia: null,
  messageFormValues: { messageText: '' },
};

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep, steps }) {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isActive    = currentStep === step.id;
        const Icon        = step.icon;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Circle + label */}
            <div className="flex flex-col items-center min-w-[72px]">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                isCompleted
                  ? 'bg-[#2A7B6E] border-[#2A7B6E] text-white'
                  : isActive
                  ? 'bg-white border-[#2A7B6E] text-[#2A7B6E]'
                  : 'bg-white border-[#E1E7EF] text-[#B0B8C4]'
              }`}>
                {isCompleted ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className={`mt-1 text-xs font-medium text-center leading-tight ${
                isActive ? 'text-[#2A7B6E]' : isCompleted ? 'text-[#2A7B6E]' : 'text-[#B0B8C4]'
              }`}>
                {step.label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 transition-all duration-200 ${
                currentStep > step.id ? 'bg-[#2A7B6E]' : 'bg-[#E1E7EF]'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function CampaignBuilderContent() {
  const router = useRouter();

  // Contact groups (loaded fresh, not persisted)
  const [contactGroups, setContactGroups]   = useState([]);
  const [loadingGroups, setLoadingGroups]   = useState(false);

  // UI state
  const [showMediaSelector, setShowMediaSelector] = useState(false);
  const [sending, setSending]                     = useState(false);
  const [draftLoaded, setDraftLoaded]             = useState(false);

  // ── Persisted wizard state ──
  const [currentStep,        setCurrentStep]        = useState(DEFAULT_DRAFT.currentStep);
  const [campaignData,       setCampaignData]       = useState(DEFAULT_DRAFT.campaignData);
  const [selectedTemplate,   setSelectedTemplate]   = useState(DEFAULT_DRAFT.selectedTemplate);
  const [selectedMedia,      setSelectedMedia]      = useState(DEFAULT_DRAFT.selectedMedia);
  const [messageFormValues,  setMessageFormValues]  = useState(DEFAULT_DRAFT.messageFormValues);

  // ── Load draft from localStorage on mount ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        setCurrentStep(draft.currentStep        || DEFAULT_DRAFT.currentStep);
        setCampaignData(draft.campaignData      || DEFAULT_DRAFT.campaignData);
        setSelectedTemplate(draft.selectedTemplate ?? null);
        setSelectedMedia(draft.selectedMedia    ?? null);
        setMessageFormValues(draft.messageFormValues || DEFAULT_DRAFT.messageFormValues);
      }
    } catch {
      // corrupted storage — ignore
    } finally {
      setDraftLoaded(true);
    }
    fetchContactGroups();
  }, []);

  // ── Persist draft to localStorage whenever state changes ──
  useEffect(() => {
    if (!draftLoaded) return;
    const draft = { currentStep, campaignData, selectedTemplate, selectedMedia, messageFormValues };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draftLoaded, currentStep, campaignData, selectedTemplate, selectedMedia, messageFormValues]);

  // ── Fetch contact groups ──
  const fetchContactGroups = async () => {
    setLoadingGroups(true);
    try {
      const response = await axiosInstance.get('/api/contacts/groups');
      if (response.data?.success && response.data.data) {
        setContactGroups(response.data.data.filter(g => g.status === 1));
      } else if (Array.isArray(response.data)) {
        setContactGroups(response.data.filter(g => g.status === 1));
      } else {
        setContactGroups([]);
      }
    } catch {
      setContactGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  // ── Clear draft ──
  const handleClearDraft = async () => {
    const result = await Swal.fire({
      title: 'Clear campaign draft?',
      text: 'All your progress will be lost and you\'ll start fresh.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, clear it',
      cancelButtonText: 'Keep draft',
      background: '#FFFFFF',
      color: '#121212',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#E1E7EF',
      customClass: {
        popup: 'rounded-xl border border-[#E1E7EF]',
        cancelButton: 'text-[#737373]',
      },
    });
    if (!result.isConfirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    setCurrentStep(DEFAULT_DRAFT.currentStep);
    setCampaignData(DEFAULT_DRAFT.campaignData);
    setSelectedTemplate(null);
    setSelectedMedia(null);
    setMessageFormValues(DEFAULT_DRAFT.messageFormValues);
  };

  // ── Campaign data handlers ──
  const handleCampaignDataChange = (e) => {
    const { name, value } = e.target;
    setCampaignData(prev => ({ ...prev, [name]: value }));
  };

  const handleContactGroupSelect = (e) => {
    const selectedId = Number(e.target.value);
    if (selectedId && !campaignData.contactGroupIds.includes(selectedId)) {
      setCampaignData(prev => ({ ...prev, contactGroupIds: [...prev.contactGroupIds, selectedId] }));
    }
  };

  const removeContactGroup = (groupId) => {
    setCampaignData(prev => ({ ...prev, contactGroupIds: prev.contactGroupIds.filter(id => id !== groupId) }));
  };

  // ── Template handler ──
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);

    if (template) {
      let bodyText = '';
      if (template.bodyText) {
        bodyText = template.bodyText;
      } else if (template.temp_data?.body) {
        bodyText = typeof template.temp_data.body === 'string'
          ? template.temp_data.body
          : template.temp_data.body.text || '';
      }
      setMessageFormValues(prev => ({ ...prev, messageText: bodyText }));

      if (template.template_media_url && template.template_media_type && template.template_media_type !== 'NONE') {
        setSelectedMedia({
          url: template.template_media_url,
          type: template.template_media_type.toLowerCase(),
          filename: template.template_media_url.split('/').pop(),
          isFromTemplate: true,
        });
      } else {
        setSelectedMedia(null);
      }
    } else {
      setSelectedMedia(null);
    }
  };

  // ── Media handler ──
  const handleMediaSelect = (media) => {
    setSelectedMedia(media);
    setShowMediaSelector(false);
  };

  // ── Step validation ──
  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!campaignData.campaignName.trim()) {
          showError('Campaign name is required.');
          return false;
        }
        if (campaignData.contactGroupIds.length === 0) {
          showError('Select at least one contact group.');
          return false;
        }
        if (campaignData.scheduleType === 'recurring') {
          if (!campaignData.frequencyAmount || !campaignData.frequencyUnit) {
            showError('Recurring frequency details are required.');
            return false;
          }
          if (!campaignData.recurringEnd) {
            showError('Recurring end date is required.');
            return false;
          }
        }
        return true;

      case 2:
        if (!selectedTemplate) {
          showError('Please select a WhatsApp template to continue.');
          return false;
        }
        return true;

      case 3:
        // Media is optional
        return true;

      default:
        return true;
    }
  };

  const showError = (text) => {
    Swal.fire({
      title: 'Required',
      text,
      icon: 'warning',
      background: '#FFFFFF',
      color: '#121212',
      customClass: {
        popup: 'rounded-xl border border-[#E1E7EF]',
        confirmButton: 'px-4 py-2 bg-[#2A7B6E] text-white rounded-lg hover:bg-[#24695F] transition-colors duration-200',
      },
    });
  };

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  };

  const goBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  // ── Submit ──
  const handleSendMessage = async () => {
    if (!selectedTemplate) { showError('Please select a WhatsApp template.'); return; }
    if (!campaignData.campaignName.trim()) { showError('Campaign name is required.'); return; }
    if (campaignData.contactGroupIds.length === 0) { showError('Select at least one contact group.'); return; }
    if (campaignData.scheduleType === 'recurring') {
      if (!campaignData.frequencyAmount || !campaignData.frequencyUnit) { showError('Recurring frequency details are required.'); return; }
      if (!campaignData.recurringEnd) { showError('Recurring end date is required.'); return; }
    }

    setSending(true);
    try {
      const payload = {
        messageText: messageFormValues.messageText.trim(),
        campaignName: campaignData.campaignName,
        contactGroupIds: campaignData.contactGroupIds,
        scheduleType: campaignData.scheduleType === 'recurring' ? 'recurring' : 'onetime',
      };

      if (selectedMedia?.url)          payload.mediaurl        = selectedMedia.url;
      if (selectedTemplate?.template_name) payload.templateName = selectedTemplate.template_name;
      if (campaignData.scheduleTime)   payload.scheduleTime    = campaignData.scheduleTime;

      if (campaignData.scheduleType === 'recurring') {
        payload.frequencyCycle  = campaignData.frequencyCycle;
        payload.frequencyAmount = campaignData.frequencyAmount;
        payload.frequencyUnit   = campaignData.frequencyUnit;
        payload.recurringEnd    = campaignData.recurringEnd;
      }

      const response = await axiosInstance.post('/api/cloud-campaign/send-message-bulk-private', payload);

      if (response.data.success) {
        await Swal.fire({
          title: 'Campaign Created!',
          text: response.data.message,
          icon: 'success',
          background: '#FFFFFF',
          color: '#121212',
          timer: 2000,
          timerProgressBar: true,
          customClass: {
            popup: 'rounded-xl border border-[#E1E7EF]',
            confirmButton: 'px-4 py-2 bg-[#2A7B6E] text-white rounded-lg hover:bg-[#24695F] transition-colors duration-200',
          },
        });

        // Clear draft and redirect
        localStorage.removeItem(STORAGE_KEY);
        router.push('/dashboard/customer/cloud-api/cloud-campaign-reports');
      } else {
        throw new Error(response.data.message || 'Failed to create campaign');
      }
    } catch (error) {
      Swal.fire({
        title: 'Error',
        text: error.response?.data?.message || error.message,
        icon: 'error',
        background: '#FFFFFF',
        color: '#121212',
        customClass: {
          popup: 'rounded-xl border border-[#E1E7EF]',
          confirmButton: 'px-4 py-2 bg-[#2A7B6E] text-white rounded-lg hover:bg-[#24695F] transition-colors duration-200',
        },
      });
    } finally {
      setSending(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Campaign Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#121212]">
            Campaign Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="campaignName"
            value={campaignData.campaignName}
            onChange={handleCampaignDataChange}
            className="w-full py-3 px-4 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent"
            placeholder="e.g. Summer Sale Campaign"
          />
        </div>

        {/* Schedule Time */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#121212]">Schedule Time</label>
          <input
            type="datetime-local"
            name="scheduleTime"
            value={campaignData.scheduleTime}
            onChange={handleCampaignDataChange}
            className="w-full py-3 px-4 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent"
          />
          <p className="text-xs text-[#737373]">Leave blank to send immediately.</p>
        </div>

        {/* Schedule Type */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[#121212]">Schedule Type</label>
          <select
            name="scheduleType"
            value={campaignData.scheduleType}
            onChange={handleCampaignDataChange}
            className="w-full py-3 px-4 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent appearance-none"
          >
            <option value="onetime">One-time</option>
            <option value="recurring">Recurring</option>
          </select>
        </div>

        {/* Recurring fields */}
        {campaignData.scheduleType === 'recurring' && (
          <>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#121212]">Repeat Every</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="frequencyAmount"
                  value={campaignData.frequencyAmount}
                  onChange={handleCampaignDataChange}
                  min="1"
                  className="w-20 py-3 px-4 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent"
                />
                <select
                  name="frequencyUnit"
                  value={campaignData.frequencyUnit}
                  onChange={handleCampaignDataChange}
                  className="flex-1 py-3 px-4 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent appearance-none"
                >
                  <option value="day">Day(s)</option>
                  <option value="week">Week(s)</option>
                  <option value="month">Month(s)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#121212]">End Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                name="recurringEnd"
                value={campaignData.recurringEnd}
                onChange={handleCampaignDataChange}
                className="w-full py-3 px-4 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent"
              />
            </div>
          </>
        )}
      </div>

      {/* Contact Groups */}
      <div className="space-y-2">
        <label className="flex items-center text-sm font-medium text-[#121212]">
          <UserPlus className="h-4 w-4 mr-2" />
          Contact Groups <span className="text-red-500 ml-1">*</span>
        </label>

        {loadingGroups ? (
          <div className="flex items-center gap-2 py-4 text-[#737373]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading contact groups...
          </div>
        ) : contactGroups.length === 0 ? (
          <div className="text-center py-4 bg-[#F8FAFB] rounded-lg border border-[#E1E7EF]">
            <p className="text-[#737373]">No contact groups available.</p>
            <a href="/dashboard/customer/contacts/groups" className="text-[#2A7B6E] text-sm mt-1 inline-block hover:underline">
              Create a contact group →
            </a>
          </div>
        ) : (
          <div>
            <select
              onChange={handleContactGroupSelect}
              value={0}
              className="w-full py-3 px-4 bg-white border border-[#E1E7EF] rounded-lg text-[#121212] focus:outline-none focus:ring-2 focus:ring-[#2A7B6E] focus:border-transparent"
            >
              <option value={0}>Select a contact group to add...</option>
              {contactGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}{group.contact_count ? ` (${group.contact_count} contacts)` : ''}
                </option>
              ))}
            </select>

            {campaignData.contactGroupIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {campaignData.contactGroupIds.map(groupId => {
                  const group = contactGroups.find(g => g.id === groupId);
                  return group ? (
                    <div key={groupId} className="bg-[#2A7B6E]/10 border border-[#2A7B6E]/20 text-[#2A7B6E] px-3 py-1.5 rounded-full flex items-center text-sm font-medium">
                      {group.name}
                      <button onClick={() => removeContactGroup(groupId)} className="ml-2 hover:text-red-500 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <p className="text-sm text-[#737373]">
        Select an approved WhatsApp Cloud API template. This is required for all Cloud API campaigns.
      </p>
      <TemplateSelector
        onTemplateSelect={handleTemplateSelect}
        disabled={sending}
      />
      {!selectedTemplate && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          You must select a template to proceed to the next step.
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5">
      <p className="text-sm text-[#737373]">
        Optionally attach media (image, video or document) to your campaign. If your template includes
        media, it has been pre-selected below — you can change or remove it.
      </p>

      {selectedMedia ? (
        <div className="bg-[#F8FAFB] border border-[#E1E7EF] rounded-xl p-5 flex flex-col items-center gap-4">
          {/* Preview */}
          <div className="w-full max-w-sm h-56 bg-white border border-[#E1E7EF] rounded-lg overflow-hidden flex items-center justify-center">
            {selectedMedia.file_type?.startsWith('image/') || selectedMedia.type === 'image' ? (
              <img src={selectedMedia.url} alt={selectedMedia.file_name || selectedMedia.filename} className="w-full h-full object-contain p-2" />
            ) : selectedMedia.file_type?.startsWith('video/') || selectedMedia.type === 'video' ? (
              <video src={selectedMedia.url} controls className="w-full h-full object-contain p-2" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-[#737373]">
                <ImageIcon className="h-14 w-14" />
                <span className="text-sm">{selectedMedia.file_name || selectedMedia.filename || 'Document'}</span>
              </div>
            )}
          </div>

          {selectedMedia.isFromTemplate && (
            <div className="flex items-center gap-1.5 text-xs text-[#2A7B6E] bg-[#2A7B6E]/10 px-3 py-1.5 rounded-full">
              <CheckCircle className="h-3.5 w-3.5" />
              Auto-selected from template
            </div>
          )}

          <p className="text-sm font-medium text-[#121212] truncate max-w-full text-center">
            {selectedMedia.file_name || selectedMedia.filename}
          </p>

          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={() => setShowMediaSelector(true)}
              className="flex-1 px-3 py-2 bg-white border border-[#E1E7EF] text-[#737373] rounded-lg hover:bg-[#E1E7EF] transition-colors text-sm font-medium"
            >
              Change
            </button>
            <button
              onClick={() => setSelectedMedia(null)}
              className="flex-1 px-3 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#F8FAFB] border-2 border-dashed border-[#E1E7EF] rounded-xl p-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-white border border-[#E1E7EF] rounded-full flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-[#B0B8C4]" />
          </div>
          <p className="text-[#737373] text-sm text-center">
            No media selected. Your campaign will be text-only.
          </p>
          <button
            onClick={() => setShowMediaSelector(true)}
            className="px-5 py-2 bg-[#2A7B6E] text-white rounded-lg hover:bg-[#24695F] transition-colors text-sm font-medium"
          >
            Select Media
          </button>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="bg-[#F8FAFB] border border-[#E1E7EF] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-[#737373] font-medium uppercase tracking-wide mb-1">Campaign</p>
          <p className="font-semibold text-[#121212]">{campaignData.campaignName || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-[#737373] font-medium uppercase tracking-wide mb-1">Template</p>
          <p className="font-semibold text-[#121212]">{selectedTemplate?.template_name || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-[#737373] font-medium uppercase tracking-wide mb-1">Media</p>
          <p className="font-semibold text-[#121212]">
            {selectedMedia
              ? (selectedMedia.file_name || selectedMedia.filename || 'Attached')
              : 'None (text-only)'}
          </p>
        </div>
      </div>

      {/* Message form */}
      <MessageForm
        onSendMessage={handleSendMessage}
        onAttachMedia={() => setShowMediaSelector(true)}
        sending={sending}
        values={messageFormValues}
        onFormChange={setMessageFormValues}
        isCampaign={true}
        hideRecipientField={true}
      />
    </div>
  );

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4];

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F8FAFB] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#121212]">Advanced Campaign Builder</h1>
            <p className="mt-1 text-sm text-[#737373]">
              Create powerful scheduled campaigns using WhatsApp Cloud API templates.
            </p>
          </div>
          <button
            onClick={handleClearDraft}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E1E7EF] text-[#737373] rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors text-sm font-medium self-start shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            Clear Draft
          </button>
        </div>

        {/* ── Step Indicator ── */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] p-5">
          <StepIndicator currentStep={currentStep} steps={STEPS} />
          <p className="mt-3 text-center text-sm text-[#737373]">
            Step {currentStep} of {STEPS.length} — <span className="text-[#2A7B6E] font-medium">{STEPS[currentStep - 1].description}</span>
          </p>
        </div>

        {/* ── Step Content ── */}
        <div className="bg-white rounded-xl border border-[#E1E7EF] p-6">
          <h2 className="text-lg font-semibold text-[#121212] mb-6 flex items-center gap-2">
            {(() => {
              const Icon = STEPS[currentStep - 1].icon;
              return <Icon className="h-5 w-5 text-[#2A7B6E]" />;
            })()}
            {STEPS[currentStep - 1].label}
          </h2>

          {stepContent[currentStep - 1]()}
        </div>

        {/* ── Navigation ── (hidden on step 4 — MessageForm has its own submit) */}
        {currentStep < 4 && (
          <div className="flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#E1E7EF] text-[#737373] rounded-lg hover:bg-[#F8FAFB] transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <button
              onClick={goNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#2A7B6E] text-white rounded-lg hover:bg-[#24695F] transition-colors text-sm font-semibold shadow-sm"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Back button on step 4 */}
        {currentStep === 4 && (
          <div className="flex items-center justify-between">
            <button
              onClick={goBack}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[#E1E7EF] text-[#737373] rounded-lg hover:bg-[#F8FAFB] transition-colors text-sm font-medium"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <p className="text-xs text-[#737373]">Use the "Create Campaign" button in the form above to submit.</p>
          </div>
        )}
      </div>

      {/* ── Media Selector Modal ── */}
      {showMediaSelector && (
        <MediaSelector
          isOpen={showMediaSelector}
          onClose={() => setShowMediaSelector(false)}
          onSelect={handleMediaSelect}
        />
      )}
    </div>
  );
}

export default function CampaignBuilder() {
  return <CampaignBuilderContent />;
}
