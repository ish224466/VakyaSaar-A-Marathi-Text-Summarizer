import React, {useState,useEffect} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Cog8ToothIcon, PlusIcon, Squares2X2Icon} from "@heroicons/react/24/outline";
import {CloseSideBarIcon, iconProps, OpenSideBarIcon} from "../svg";
import {useTranslation} from 'react-i18next';
import Tooltip from "./Tooltip";
import UserSettingsModal from './UserSettingsModal';
import ChatShortcuts from './ChatShortcuts';
import ConversationList from "./ConversationList";
import { dark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface SidebarProps {
  className: string;
  isSidebarCollapsed: boolean;
  toggleSidebarCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({className, isSidebarCollapsed, toggleSidebarCollapse}) => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);

  const openSettingsDialog = () => {
    setSettingsModalVisible(true);
  }

  const handleNewChat = () => {
    navigate('/', {state: {reset: Date.now()}});
  }

  const handleOnClose = () => {
    setSettingsModalVisible(false);
  }
  
    // Close sidebar when clicking outside
  useEffect(() => {
    if (isSidebarCollapsed) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const sidebar = document.querySelector('.sidebar');
      const openButton = document.querySelector('button > svg[data-icon="open-sidebar"]')?.closest('button');

      // If click is outside sidebar AND not on the open button → close it
      if (sidebar && !sidebar.contains(target) && (!openButton || !openButton.contains(target))) {
        toggleSidebarCollapse();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSidebarCollapsed, toggleSidebarCollapse]);

  return (
    <div className={`${className} relative`}>
      {isSidebarCollapsed && (
        <div className="fixed top-4 left-4 z-50">
          <Tooltip title={t('open-sidebar')} side="right" sideOffset={10}>
            <button
              className="flex px-3 min-h-[44px] py-1 gap-3 transition-colors duration-200 dark:text-white
              cursor-pointer text-sm rounded-md border dark:border-white/20 hover:bg-gray-300 dark:hover:bg-gray-600
              h-11 w-11 shrink-0 items-center justify-center bg-white dark:bg-gray-850"
              onClick={toggleSidebarCollapse}>
              <OpenSideBarIcon/>
            </button>
          </Tooltip>
        </div>
      )}
      <UserSettingsModal
        isVisible={isSettingsModalVisible}
        onClose={handleOnClose}
      />
      {/* sidebar is always dark mode*/}
      <div
        className={`sidebar fixed left-0 top-0 h-full z-40 transition-transform duration-300 ${isSidebarCollapsed ? '-translate-x-full' : 'translate-x-0'} overflow-x-hidden bg-slate-700 dark:bg-gray-800 border-r border-white/20`} style={{}} >
        <div className="h-full w-[260px]">
          <div className="flex h-full min-h-0 flex-col ">
            <div className="scrollbar-trigger relative h-full flex-1 items-start border-white/20">
              <h2 className="sr-only">Chat history</h2>
              <nav className="flex h-full flex-col p-3 top-4" aria-label="Chat history">
                <div className="mb-1 flex flex-row gap-2">
                  <button className="flex px-3 min-h-[44px] py-1 items-center gap-3
                       transition-colors duration-200 text-white
                       cursor-pointer text-sm rounded-md border dark:border-white/20 hover:bg-gray-500/10 h-11
                       bg-slate-800 dark:bg-gray-850 grow overflow-hidden"
                          onClick={handleNewChat}
                          type="button"
                  >
                    <PlusIcon {...iconProps} />
                    <span className="truncate">{t('new-chat')}</span>
                  </button>
                  <Tooltip title={t('open-settings')} side="right" sideOffset={10}>
                    <button
                      type="button"
                      className="flex px-3 min-h-[44px] py-1 gap-3 transition-colors duration-200 text-white
                      cursor-pointer text-sm rounded-md border dark:border-white/20 hover:bg-gray-500/10 h-11 w-11
                      shrink-0 items-center justify-center bg-slate-800 dark:bg-gray-850"
                      onClick={openSettingsDialog}>
                      <Cog8ToothIcon/>
                    </button>
                  </Tooltip>
                  <Tooltip title={t('close-sidebar')} side="right" sideOffset={10}>
                    <button
                      className="flex px-3 min-h-[44px] py-1 gap-3 transition-colors duration-200 text-white
                      cursor-pointer text-sm rounded-md border dark:border-white/20 hover:bg-gray-500/10
                      h-11 w-11 shrink-0 items-center justify-center bg-slate-800 dark:bg-gray-850"
                      onClick={toggleSidebarCollapse}
                      type="button"
                    >
                      <CloseSideBarIcon/>
                    </button>
                  </Tooltip>
                </div>
                <Link to="/performance" className="flex items-center m-2 dark:bg-gray-800 dark:text-gray-100 text-gray-900">
                  <Squares2X2Icon  {...iconProps} className="mt-1 mr-2 text-white"/>
                  <span className="mt-1 mr-2 text-white">{t('Analysis')}</span>
                </Link> 
                {/* <Link to="/explore" className="flex items-center m-2 dark:bg-gray-800 dark:text-gray-100 text-gray-900">
                  <Squares2X2Icon  {...iconProps} className="mt-1 mr-2 text-white"/>
                  <span className="mt-1 mr-2 text-white">{t('custom-chats-header')}</span>
                </Link> */}
                <ChatShortcuts/>
                <ConversationList/>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
