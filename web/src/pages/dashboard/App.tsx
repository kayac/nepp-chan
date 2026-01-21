import {
  ArrowLeftEndOnRectangleIcon,
  Bars3Icon,
  BookOpenIcon,
  ChatBubbleLeftIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

import { EmergencyPanel } from "./components/EmergencyPanel";
import { FeedbackPanel } from "./components/FeedbackPanel";
import { InvitationsPanel } from "./components/InvitationsPanel";
import { KnowledgePanel } from "./components/KnowledgePanel";
import { PersonaPanel } from "./components/PersonaPanel";
import { useAuth } from "./contexts/AuthContext";

type Tab = "knowledge" | "persona" | "feedback" | "emergency" | "invitations";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "knowledge",
    label: "ナレッジ",
    icon: <BookOpenIcon className="w-4 h-4" aria-hidden="true" />,
  },
  {
    id: "persona",
    label: "ペルソナ",
    icon: <UserGroupIcon className="w-4 h-4" aria-hidden="true" />,
  },
  {
    id: "feedback",
    label: "フィードバック",
    icon: <ChatBubbleLeftIcon className="w-4 h-4" aria-hidden="true" />,
  },
  {
    id: "emergency",
    label: "緊急情報",
    icon: <ExclamationTriangleIcon className="w-4 h-4" aria-hidden="true" />,
  },
  {
    id: "invitations",
    label: "招待管理",
    icon: <EnvelopeIcon className="w-4 h-4" aria-hidden="true" />,
  },
];

export const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>("knowledge");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/dashboard/login";
  };

  const handleTabChange = (tabId: Tab) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center text-white text-xs font-bold">
                管
              </div>
              <div>
                <h1 className="text-base font-bold text-stone-800">
                  ねっぷちゃん
                </h1>
                <p className="text-[11px] text-stone-500 -mt-0.5">管理画面</p>
              </div>
            </div>

            {/* Desktop Header Actions */}
            <div className="hidden sm:flex items-center gap-4">
              {user && (
                <span className="text-sm text-stone-600 truncate max-w-48">
                  {user.email}
                </span>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-800"
              >
                <ArrowLeftEndOnRectangleIcon className="w-4 h-4" />
                ログアウト
              </button>
              <a
                href="/"
                className="text-sm text-teal-700 hover:text-teal-800 hover:underline"
              >
                チャットへ戻る
              </a>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 -mr-2 text-stone-600 hover:text-stone-800"
              aria-label="メニューを開く"
            >
              {mobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-stone-200 bg-white">
            <div className="px-4 py-3 space-y-3">
              {user && (
                <div className="text-sm text-stone-600 truncate">
                  {user.email}
                </div>
              )}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-800"
                >
                  <ArrowLeftEndOnRectangleIcon className="w-4 h-4" />
                  ログアウト
                </button>
                <a
                  href="/"
                  className="text-sm text-teal-700 hover:text-teal-800"
                >
                  チャットへ戻る
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Tab Navigation */}
        <nav className="flex gap-1 p-1 bg-stone-100 rounded-lg mb-4 sm:mb-6 sm:w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`
                flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 px-1.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-sm font-medium rounded-md
                transition-colors duration-150 whitespace-nowrap flex-1 sm:flex-none
                ${
                  activeTab === tab.id
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-stone-600 hover:text-stone-800 hover:bg-stone-50"
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Main Content */}
        <main key={activeTab} className="animate-fade-in">
          {activeTab === "knowledge" && <KnowledgePanel />}
          {activeTab === "persona" && <PersonaPanel />}
          {activeTab === "feedback" && <FeedbackPanel />}
          {activeTab === "emergency" && <EmergencyPanel />}
          {activeTab === "invitations" && <InvitationsPanel />}
        </main>
      </div>
    </div>
  );
};
