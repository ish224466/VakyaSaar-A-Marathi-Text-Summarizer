import React, {useContext, useEffect, useRef, useState} from 'react';
import ChatBlock from "./ChatBlock";
import ModelSelect from "./ModelSelect";
import {OpenAIModel} from "../models/model";
import {ChatService} from "../service/ChatService";
import {ChatMessage} from "../models/ChatCompletion";
import {useTranslation} from 'react-i18next';
import Tooltip from "./Tooltip";
import {Conversation} from "../service/ConversationService";
import {OPENAI_DEFAULT_SYSTEM_PROMPT} from "../config";
import {DEFAULT_INSTRUCTIONS} from "../constants/appConstants";
import {UserContext} from '../UserContext';
import {InformationCircleIcon} from "@heroicons/react/24/outline";
import {NotificationService} from '../service/NotificationService';

interface Props {
  chatBlocks: ChatMessage[];
  onChatScroll: (isAtBottom: boolean) => void;
  allowAutoScroll: boolean;
  model: string | null;
  onModelChange: (value: string | null) => void;
  conversation: Conversation | null;
  loading: boolean;
}

const Chat: React.FC<Props> = ({
                                 chatBlocks, onChatScroll, allowAutoScroll, model,
                                 onModelChange, conversation, loading
                               }) => {
  const {userSettings, setUserSettings} = useContext(UserContext);
  const {t} = useTranslation();
  const [models, setModels] = useState<OpenAIModel[]>([]);
  const chatDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ChatService.getModels()
        .then(models => {
          setModels(models);
        })
        .catch(err => {
          // NotificationService.handleUnexpectedError(err, 'Failed to get list of models');
        });

  }, []);

  useEffect(() => {
    if (chatDivRef.current && allowAutoScroll) {
      chatDivRef.current.scrollTop = chatDivRef.current.scrollHeight;
    }
  }, [chatBlocks]);

  useEffect(() => {
    const chatContainer = chatDivRef.current;
    if (chatContainer) {
      const isAtBottom =
          chatContainer.scrollHeight - chatContainer.scrollTop ===
          chatContainer.clientHeight;

      // Initially hide the button if chat is at the bottom
      onChatScroll(isAtBottom);
    }
  }, []);

  const findModelById = (id: string | null): OpenAIModel | undefined => {
    return models.find(model => model.id === id);
  };

  const formatContextWindow = (context_window: number | undefined) => {
    if (context_window) {
      return Math.round(context_window / 1000) + 'k';
    }
    return '?k';
  }

  const handleScroll = () => {
    if (chatDivRef.current) {
      const scrollThreshold = 20;
      const isAtBottom =
          chatDivRef.current.scrollHeight -
          chatDivRef.current.scrollTop <=
          chatDivRef.current.clientHeight + scrollThreshold;

      // Notify parent component about the auto-scroll status
      onChatScroll(isAtBottom);

      // Disable auto-scroll if the user scrolls up
      if (!isAtBottom) {
        onChatScroll(false);
      }
    }
  };

  return (
    <>
    <div
          style={{position: "sticky"}}
              className={`absolute top-0 flex w-full items-center justify-center gap-1 text-gray-500 dark:border-gray-900/50 dark:text-gray-300
  bg-gradient-to-b  ${!(conversation === null) ? 'border-b border-black/10' : 'border-b border-black/10'}`}>
                
             <div className="flex items-center justify-center">
              <img src="../../public/Logo1.png" alt="Logo" className="chat-header-logo h-14 m-2"/>
            </div>
          </div>
      

      <div id={'chat-container'} ref={chatDivRef} className="relative chat-container flex-1 overflow-auto" >
          
          <div  id={'chat-container1'}  className="relative chat-container1 flex flex-col items-center text-sm ">
          <div className="w-full mx-auto px-4" style={{ maxWidth: 900 }}>
          {chatBlocks.map((block, index) => (
              <ChatBlock key={`chat-block-${block.id}`}
                         block={block}
                         loading={index === chatBlocks.length - 1 && loading}
                         isLastBlock={index === chatBlocks.length - 1}/>
          ))}
          <div className="w-full h-24 shrink-0"></div>
          </div>
        </div>
      </div>
      </>
  );
};

export default Chat;
