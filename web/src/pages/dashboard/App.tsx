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

import { cn } from "~/lib/class-merge";

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
    icon: <BookOpenIcon className="w-5 h-5" aria-hidden="true" />,
  },
  {
    id: "persona",
    label: "ペルソナ",
    icon: <UserGroupIcon className="w-5 h-5" aria-hidden="true" />,
  },
  {
    id: "feedback",
    label: "フィードバック",
    icon: <ChatBubbleLeftIcon className="w-5 h-5" aria-hidden="true" />,
  },
  {
    id: "emergency",
    label: "緊急情報",
    icon: <ExclamationTriangleIcon className="w-5 h-5" aria-hidden="true" />,
  },
  {
    id: "invitations",
    label: "招待管理",
    icon: <EnvelopeIcon className="w-5 h-5" aria-hidden="true" />,
  },
];

export const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>("knowledge");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, isLoading, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/dashboard/login";
  };

  const handleTabChange = (tabId: Tab) => {
    setActiveTab(tabId);
    setIsSidebarOpen(false);
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="flex h-dvh bg-stone-50">
      {/* サイドバーオーバーレイ */}
      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-stone-900/20 backdrop-blur-[2px] z-10 md:hidden cursor-default transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="サイドバーを閉じる"
        />
      )}

      {/* サイドバー */}
      <aside
        className={cn(
          "fixed md:relative z-20 w-64 h-full bg-white border-r border-stone-200 flex flex-col",
          "transition-transform duration-200 ease-out",
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="p-4 border-b border-stone-200">
          <div className="flex items-center justify-between">
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
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors md:hidden"
              aria-label="閉じる"
            >
              <XMarkIcon
                className="w-5 h-5 text-stone-500"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "w-full px-4 py-3 text-left transition-colors flex items-center gap-3",
                "hover:bg-stone-50",
                activeTab === tab.id &&
                  "bg-teal-50 border-l-2 border-teal-600 text-teal-700",
                activeTab !== tab.id && "text-stone-600",
              )}
            >
              {tab.icon}
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-stone-200 space-y-3">
          {user && (
            <div className="text-xs text-stone-500 truncate">{user.email}</div>
          )}
          <div className="flex flex-col gap-2">
            <a
              href="/"
              className="flex items-center gap-2 text-sm text-teal-700 hover:text-teal-800"
            >
              <ChatBubbleLeftIcon className="w-4 h-4" />
              チャットへ戻る
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-800"
            >
              <ArrowLeftEndOnRectangleIcon className="w-4 h-4" />
              ログアウト
            </button>
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 sm:px-6 h-14 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-2 hover:bg-stone-100 rounded-lg transition-colors md:hidden"
            aria-label="メニュー"
          >
            <Bars3Icon className="w-5 h-5 text-stone-600" aria-hidden="true" />
          </button>
          <h2 className="text-lg font-semibold text-stone-800">
            {tabs.find((t) => t.id === activeTab)?.label}
          </h2>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div key={activeTab} className="animate-fade-in max-w-5xl">
            {activeTab === "knowledge" && <KnowledgePanel />}
            {activeTab === "persona" && <PersonaPanel />}
            {activeTab === "feedback" && <FeedbackPanel />}
            {activeTab === "emergency" && <EmergencyPanel />}
            {activeTab === "invitations" && <InvitationsPanel />}
          </div>
        </div>
      </main>
    </div>
  );
};
