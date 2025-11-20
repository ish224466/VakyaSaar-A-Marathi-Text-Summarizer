// MessageBox.tsx
import React, {
  ChangeEvent,
  FormEvent,
  forwardRef,
  KeyboardEvent,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  useEffect
} from 'react';
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_ATTACHMENTS_PER_MESSAGE,
  MAX_ROWS,
  SNIPPET_MARKERS,
  TEXT_MIME_TYPES
} from '../constants/appConstants';
import {SubmitButton} from "./SubmitButton";
import {useTranslation} from 'react-i18next';
import {ChatService} from "../service/ChatService";
import {PaperClipIcon, StopCircleIcon} from "@heroicons/react/24/outline";
import Tooltip from "./Tooltip";
import FileDataPreview from './FileDataPreview';
import {FileDataRef} from '../models/FileData';
import {preprocessImage} from '../utils/ImageUtils';

interface MessageBoxProps {
  callApp: Function;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  allowImageAttachment: string;
  summaryTone: 'formal' | 'casual' | 'neutral';
  summaryLength: 'short' | 'medium' | 'long';
  setSummaryTone: (tone: 'formal' | 'casual' | 'neutral') => void;
  setSummaryLength: (len: 'short' | 'medium' | 'long') => void;
  showSummaryOptions: boolean;
  setShowSummaryOptions: (show: boolean) => void;
  selectedCustomModel: 'mT5-Marathi' | 'IndicBART' | 'Pegasus-Marathi';
  setSelectedCustomModel: (model: 'mT5-Marathi' | 'IndicBART' | 'Pegasus-Marathi') => void;
}

// Methods exposed to clients using useRef<MessageBoxHandles>
export interface MessageBoxHandles {
  clearInputValue: () => void;
  getTextValue: () => string;
  reset: () => void;
  resizeTextArea: () => void;
  focusTextarea: () => void;
  pasteText: (text: string) => void;
}

const MessageBox =
  forwardRef<MessageBoxHandles, MessageBoxProps>(
    ({
      loading,
      setLoading,
      callApp,
      allowImageAttachment,
      summaryTone,
      summaryLength,
      setSummaryTone,
      setSummaryLength,
      showSummaryOptions,
      setShowSummaryOptions,
      selectedCustomModel,
      setSelectedCustomModel
    }, ref) => {
      const {t} = useTranslation();
      const textValue = useRef('');
      const [isTextEmpty, setIsTextEmpty] = useState(true);
      const textAreaRef = useRef<HTMLTextAreaElement>(null);
      const resizeTimeoutRef = useRef<number | null>(null);
      const [fileDataRef, setFileDataRef] = useState<FileDataRef[]>([]);
      const [showModelOptions, setShowModelOptions] = useState(false);

      const setTextValue = (value: string) => {
        textValue.current = value;
      }

      const setTextAreaValue = (value: string) => {
        if (textAreaRef.current) {
          textAreaRef.current.value = value;
        }
        setIsTextEmpty(textAreaRef.current?.value.trim() === '');
        debouncedResize();
      }
            // Close drop-ups when clicking outside
      useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          // Only close if click is outside the buttons/dropdowns
          const target = event.target as HTMLElement;
          if (!target.closest('button') && !target.closest('select')) {
            setShowSummaryOptions(false);
            setShowModelOptions(false);
          }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }, []);

      useImperativeHandle(ref, () => ({
        // Method to clear the textarea
        clearInputValue: () => {
          clearValueAndUndoHistory(textAreaRef);
        },
        getTextValue: () => {
          return textValue.current;
        },
        reset: () => {
          clearValueAndUndoHistory(textAreaRef);
          setTextValue('');
          setTextAreaValue('');
          setFileDataRef([]);
        },
        resizeTextArea: () => {
          if (textAreaRef.current) {
            textAreaRef.current.style.height = 'auto';
          }
        },
        focusTextarea: () => {
          if (textAreaRef.current) {
            textAreaRef.current.focus();
          }
        },
        pasteText: (text: string) => {
          insertTextAtCursorPosition(text);
        },
      }));

      // Function to handle auto-resizing of the textarea
      const handleAutoResize = useCallback(() => {
        if (textAreaRef.current) {
          const target = textAreaRef.current;
          const maxHeight = parseInt(getComputedStyle(target).lineHeight || '0', 10) * MAX_ROWS;

          target.style.height = 'auto';
          if (target.scrollHeight <= maxHeight) {
            target.style.height = `${target.scrollHeight}px`;
          } else {
            target.style.height = `${maxHeight}px`;
          }
        }
      }, []);

      // Debounced resize function
      const debouncedResize = useCallback(() => {
        if (resizeTimeoutRef.current !== null) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = window.setTimeout(() => {
          handleAutoResize();
        }, 100); // Adjust the debounce time as needed
      }, []);

      const handleTextValueUpdated = () => {
        debouncedResize();

        // After resizing, scroll the textarea to the insertion point (end of the pasted text).
        if (textAreaRef.current) {
          const textarea = textAreaRef.current;
          // Check if the pasted content goes beyond the max height (overflow scenario)
          if (textarea.scrollHeight > textarea.clientHeight) {
            // Scroll to the bottom of the textarea
            textarea.scrollTop = textarea.scrollHeight;
          }
        }
      };

      function clearValueAndUndoHistory(textAreaRef: React.RefObject<HTMLTextAreaElement | null>) {
        setFileDataRef([]);
        setTextValue('');
        setTextAreaValue('');
      }

      const insertTextAtCursorPosition = (textToInsert: string) => {
        if (textAreaRef.current) {
          const textArea = textAreaRef.current;
          const startPos = textArea.selectionStart || 0;
          const endPos = textArea.selectionEnd || 0;
          const text = textArea.value;
          const newTextValue =
            text.substring(0, startPos) +
            textToInsert +
            text.substring(endPos);

          // Update the state with the new value
          setTextValue(newTextValue);
          setTextAreaValue(newTextValue);

          // Dispatch a new InputEvent for the insertion of text
          // This event should be undoable
          // const inputEvent = new InputEvent('input', {
          //   bubbles: true,
          //   cancelable: true,
          //   inputType: 'insertText',
          //   data: textToInsert,
          // });
          // textArea.dispatchEvent(inputEvent);

          // Move the cursor to the end of the inserted text
          const newCursorPos = startPos + textToInsert.length;
          setTimeout(() => {
            textArea.selectionStart = newCursorPos;
            textArea.selectionEnd = newCursorPos;
            // Scroll to the insertion point after the DOM update
            if (textArea.scrollHeight > textArea.clientHeight) {
              textArea.scrollTop = textArea.scrollHeight;
            }
          }, 0);
        }
      };

      const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {

        if (event.clipboardData && event.clipboardData.items) {
          const items = event.clipboardData.items;

          for (const item of items) {
            if (item.type.indexOf("image") === 0 && allowImageAttachment !== 'no') {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) {
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                  if (loadEvent.target !== null) {
                    const base64Data = loadEvent.target.result;

                    if (typeof base64Data === 'string') {
                      preprocessImage(file, (base64Data, processedFile) => {
                        setFileDataRef((prevData) => [...prevData, {
                          id: 0,
                          fileData: {
                            data: base64Data,
                            type: processedFile.type,
                            source: 'pasted',
                            filename: 'pasted-image',
                          }
                        }]);
                      });
                      if (allowImageAttachment == 'warn') {
                        // todo: could warn user
                      }
                    }
                  }
                };
                reader.readAsDataURL(file);
              }
            } else {

            }
          }
        }

        // Get the pasted text from the clipboard
        const pastedText = event.clipboardData.getData('text/plain');


        // Check if the pasted text contains the snippet markers
        const containsBeginMarker = pastedText.includes(SNIPPET_MARKERS.begin);
        const containsEndMarker = pastedText.includes(SNIPPET_MARKERS.end);

        // If either marker is found, just allow the default paste behavior
        if (containsBeginMarker || containsEndMarker) {
          return; // Early return if markers are present
        }

        // Count the number of newlines in the pasted text
        const newlineCount = (pastedText.match(/\n/g) || []).length;

        // Check if there are MAX_ROWS or more newlines
        if (newlineCount >= MAX_ROWS || pastedText.length > 80 * MAX_ROWS) {
          event.preventDefault();
          const modifiedText = `${SNIPPET_MARKERS.begin}\n${pastedText}\n${SNIPPET_MARKERS.end}\n`;
          insertTextAtCursorPosition(modifiedText);
        } else {
          // Allow the default paste behavior to occur
          // The textarea value will be updated automatically
        }
      };

      const checkForSpecialKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        const isEnter = (e.key === 'Enter');

        if (isEnter) {
          if (e.shiftKey) {
            return;
          } else {
            if (!loading) {
              e.preventDefault();
              if (textAreaRef.current) {
                setTextValue(textAreaRef.current.value);
              }
              callApp(textAreaRef.current?.value || '', (allowImageAttachment === 'yes') ? fileDataRef : []);
            }
          }
        }
      };

      const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = event.target.value;
        setIsTextEmpty(textAreaRef.current?.value.trim() === '');
        handleTextValueUpdated();
      };

      const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (textAreaRef.current) {
          setTextValue(textAreaRef.current.value);
        }
        callApp(textAreaRef.current?.value || '', (allowImageAttachment === 'yes') ? fileDataRef : []);
        if (textAreaRef.current) {
          textAreaRef.current.style.height = 'auto';
        }
      };
      const handleCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        ChatService.cancelStream();
        setLoading(false);
      };


      const handleAttachment = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        // Create an input element of type file
        const fileInput = document.createElement('input');
        fileInput.setAttribute('type', 'file');
        fileInput.setAttribute('multiple', '');
        const acceptedMimeTypes = ((allowImageAttachment !== 'no') ? IMAGE_MIME_TYPES : []).concat(TEXT_MIME_TYPES).join(',');
        fileInput.setAttribute('accept', acceptedMimeTypes);
        fileInput.click();

        // Event listener for file selection
        fileInput.onchange = (e) => {
          const files = fileInput.files;
          if (files) {
            Array.from(files).forEach((file) => {
              // Check if the file is an image
              if (file.type.startsWith('image/')) {
                if (fileDataRef.length >= MAX_IMAGE_ATTACHMENTS_PER_MESSAGE) {
                  return;
                }
                preprocessImage(file, (base64Data, processedFile) => {
                  setFileDataRef((prev) => [...prev, {
                    id: 0,
                    fileData: {
                      data: base64Data,
                      type: processedFile.type,
                      source: 'filename',
                      filename: processedFile.name,
                    }
                  }]);
                  if (allowImageAttachment == 'warn') {
                    // todo: could warn user
                  }
                });
              }
              // Else, if the file is a text file
              else if (file.type.startsWith('text/')) {
                const reader = new FileReader();

                reader.onloadend = () => {
                  const textContent = reader.result as string;
                  const formattedText = `File: ${file.name}:\n${SNIPPET_MARKERS.begin}\n${textContent}\n${SNIPPET_MARKERS.end}\n`;
                  insertTextAtCursorPosition(formattedText);

                  // Focus the textarea and place the cursor at the end of the text
                  if (textAreaRef.current) {
                    const textArea = textAreaRef.current;
                    textArea.focus();

                    const newCursorPos = textArea.value.length;

                    // Use setTimeout to ensure the operation happens in the next tick after render reflow
                    setTimeout(() => {
                      textArea.selectionStart = newCursorPos;
                      textArea.selectionEnd = newCursorPos;
                      handleAutoResize();
                      textArea.scrollTop = textArea.scrollHeight;
                    }, 0);
                  }
                };

                reader.onerror = (errorEvent) => {
                  console.error("File reading error:", errorEvent.target?.error);
                };

                reader.readAsText(file);
              }
            });
          }
        };
      };


      const handleRemoveFileData = (index: number, fileRef: FileDataRef) => {
        setFileDataRef(fileDataRef.filter((_, i) => i !== index));
      };

            return (
        <div
          style={{ position: "sticky" }}
          className="absolute bottom-0 left-0 w-full border-t md:border-t-0 dark:border-white/20 md:border-transparent md:dark:border-transparent md:bg-transparent pt-2"
        >
          <form
            onSubmit={handleSubmit}
            className="stretch mx-2 flex flex-row gap-3 last:mb-2 md:mx-4 md:last:mb-6 lg:mx-auto md:max-w-2xl lg:max-w-2xl xl:max-w-4xl 2xl:max-w-5xl 3xl:max-w-6xl 4xl:max-w-7xl"
          >
            <div
              id="message-box-border"
              style={{ borderRadius: "4rem", maxWidth: "950px", marginInline: "auto" }}
              className="relative flex flex-col h-full flex-1 w-4/5 py-2 grow md:py-3 bg-white dark:text-white dark:bg-gray-800 border border-black/10 dark:border-white-800/40 focus-within:ring-1 focus-within:border-black/30 dark:focus-within:border-gray-500/50"
            >
              {/* File Preview */}
              {fileDataRef.length > 0 && (
                <div className="w-full">
                  <FileDataPreview
                    fileDataRef={fileDataRef}
                    removeFileData={handleRemoveFileData}
                    allowImageAttachment={allowImageAttachment === 'yes'}
                  />
                </div>
              )}

              {/* Input Row */}
              <div className="flex items-center w-full relative space-x-2">
                {/* Attachment Button */}
                <div className="flex items-center justify-start">
                  <button onClick={handleAttachment} className="px-4 relative z-10">
                    <PaperClipIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Grammarly placeholder */}
                <div className="flex items-center" style={{ flexShrink: 0, minWidth: 'fit-content' }} />

                {/* Textarea */}
                <textarea
                  id="sendMessageInput"
                  name="message"
                  tabIndex={0}
                  ref={textAreaRef}
                  rows={1}
                  className="flex-auto m-0 resize-none border-0 bg-transparent px-2 py-2 focus:ring-0 focus-visible:ring-0 outline-none shadow-none dark:bg-transparent"
                  placeholder={t('send-a-message')}
                  onKeyDown={checkForSpecialKey}
                  onChange={handleTextChange}
                  onPaste={handlePaste}
                  style={{ minWidth: 0 }}
                />

                                {/* Right side: Model Selector + Tone/Length + Submit */}
                <div className="flex items-center gap-2">
                  {/* Model Selector */}
                                    {/* Model Selector Button */}
                  <button
                    type="button"
                    onClick={() => setShowModelOptions(!showModelOptions  )}
                    className="px-4 py-2 text-sm font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors whitespace-nowrap"
                  >
                    {selectedCustomModel === 'mT5-Marathi' && 'mT5-Marathi'}
                    {selectedCustomModel === 'IndicBART' && 'IndicBART'}
                    {selectedCustomModel === 'Pegasus-Marathi' && 'Pegasus (Best)'} ▼
                  </button>

                  {/* Model Drop-up Panel */}
                  {showModelOptions && (
                    <div className="absolute bottom-16 right-10 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl p-3 z-50">
                      <div className="space-y-1">
                        {(['mT5-Marathi', 'IndicBART', 'Pegasus-Marathi'] as const).map(model => (
                          <button
                            key={model}
                            onClick={() => {
                              setSelectedCustomModel(model);
                              setShowModelOptions(false);
                            }}
                            className={`w-full text-left px-4 py-2 rounded-md text-sm transition-colors ${
                              selectedCustomModel === model
                                ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-medium'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {model === 'mT5-Marathi' && 'mT5-Marathi'}
                            {model === 'IndicBART' && 'IndicBART'}
                            {model === 'Pegasus-Marathi' && 'Pegasus-Marathi (Best Quality)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tone • Length Button */}
                  {selectedCustomModel === 'Pegasus-Marathi' && (
                  <button
                    type="button"
                    onClick={() => setShowSummaryOptions(!showSummaryOptions)}
                    className="px-3 py-2 text-xs font-medium bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
                    title="Summary tone & length"
                  >
                    
                      <>
                        {summaryTone.charAt(0).toUpperCase() + summaryTone.slice(1)} •{' '}
                        {summaryLength === 'short' ? 'Short' : summaryLength === 'medium' ? 'Med' : 'Long'} ▼
                      </>
                    
                  </button>
                  )}

                  {/* Submit Button */}
                  {loading ? (
                    <Tooltip title={t('cancel-output')} side="top" sideOffset={0}>
                      <button onClick={handleCancel} className="p-1">
                        <StopCircleIcon className="h-6 w-6" />
                      </button>
                    </Tooltip>
                  ) : (
                    <SubmitButton disabled={isTextEmpty || loading} loading={loading} />
                  )}
                </div>
              </div>

              {/* Drop-up Panel (appears above input) */}
              {showSummaryOptions && selectedCustomModel === 'Pegasus-Marathi' && (
                <div className="absolute bottom-18 right-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl p-3 z-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Tone</label>
                      <select
                        value={summaryTone}
                        onChange={(e) => setSummaryTone(e.target.value as any)}
                        className="w-full px-3 py-2 rounded border dark:bg-gray-700 text-sm"
                      >
                        <option value="neutral">Neutral</option>
                        <option value="formal">Formal</option>
                        <option value="casual">Casual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Length</label>
                      <select
                        value={summaryLength}
                        onChange={(e) => setSummaryLength(e.target.value as any)}
                        className="w-full px-3 py-2 rounded border dark:bg-gray-700 text-sm"
                      >
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      );
    });

export default MessageBox;
