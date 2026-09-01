import {
  ArrowLeftEndOnRectangleIcon,
  BanknotesIcon,
  Bars3Icon,
  BookOpenIcon,
  ChartBarIcon,
  ChatBubbleLeftIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  HandThumbUpIcon,
  HomeIcon,
  MegaphoneIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { useMemo, useState } from "react";
import {
  AnalyticsPanel,
  type AnalyticsSection,
} from "~/app/dashboard/components/AnalyticsPanel";
import { BroadcastPanel } from "~/app/dashboard/components/BroadcastPanel";
import { FeedbackPanel } from "~/app/dashboard/components/FeedbackPanel";
import { HomePanel } from "~/app/dashboard/components/HomePanel";
import { InvitationsPanel } from "~/app/dashboard/components/InvitationsPanel";
import { KnowledgePanel } from "~/app/dashboard/components/KnowledgePanel";
import {
  MayorChatPanel,
  type MayorRequest,
} from "~/app/dashboard/components/mayor/MayorChatPanel";
import { PollPanel } from "~/app/dashboard/components/PollPanel";
import { ReviewPanel } from "~/app/dashboard/components/ReviewPanel";
import { UsagePanel } from "~/app/dashboard/components/UsagePanel";
import { VoicesPanel } from "~/app/dashboard/components/VoicesPanel";
import type { VoiceFilter } from "~/app/dashboard/components/voices/helpers";
import { WidgetSitesPanel } from "~/app/dashboard/components/WidgetSitesPanel";
import { useAuth } from "~/app/dashboard/contexts/AuthContext";
import { useRole } from "~/app/dashboard/hooks/useRole";
import type { AdminUser } from "~/lib/api/auth";

export type Tab =
  | "home"
  | "analytics"
  | "voices"
  | "broadcast"
  | "poll"
  | "knowledge"
  | "feedback"
  | "review"
  | "invitations"
  | "widget-sites"
  | "usage";

type AdminRole = AdminUser["role"];

type TabGroup = "watch" | "send" | "system";

const tabGroups: { id: TabGroup; label: string }[] = [
  { id: "watch", label: "見る" },
  { id: "send", label: "送る" },
  { id: "system", label: "システム" },
];

const tabs: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  group: TabGroup;
  minRole?: AdminRole;
}[] = [
  {
    id: "home",
    label: "ホーム",
    icon: <HomeIcon className="w-5 h-5" aria-hidden="true" />,
    group: "watch",
  },
  {
    id: "analytics",
    label: "村の分析",
    icon: <ChartBarIcon className="w-5 h-5" aria-hidden="true" />,
    group: "watch",
  },
  {
    id: "voices",
    label: "みんなの声",
    icon: <ChatBubbleLeftRightIcon className="w-5 h-5" aria-hidden="true" />,
    group: "watch",
  },
  {
    id: "broadcast",
    label: "LINE配信",
    icon: <MegaphoneIcon className="w-5 h-5" aria-hidden="true" />,
    group: "send",
  },
  {
    id: "poll",
    label: "投票",
    icon: <HandThumbUpIcon className="w-5 h-5" aria-hidden="true" />,
    group: "send",
  },
  {
    id: "knowledge",
    label: "ナレッジ",
    icon: <BookOpenIcon className="w-5 h-5" aria-hidden="true" />,
    group: "system",
    minRole: "super_admin",
  },
  {
    id: "review",
    label: "回答レビュー",
    icon: <ClipboardDocumentCheckIcon className="w-5 h-5" aria-hidden="true" />,
    group: "watch",
    minRole: "admin",
  },
  {
    id: "feedback",
    label: "フィードバック",
    icon: <ChatBubbleLeftIcon className="w-5 h-5" aria-hidden="true" />,
    group: "system",
    minRole: "super_admin",
  },
  {
    id: "invitations",
    label: "招待管理",
    icon: <EnvelopeIcon className="w-5 h-5" aria-hidden="true" />,
    group: "system",
    minRole: "super_admin",
  },
  {
    id: "widget-sites",
    label: "設置サイト",
    icon: <GlobeAltIcon className="w-5 h-5" aria-hidden="true" />,
    group: "system",
    minRole: "super_admin",
  },
  {
    id: "usage",
    label: "利用コスト",
    icon: <BanknotesIcon className="w-5 h-5" aria-hidden="true" />,
    group: "system",
    minRole: "super_admin",
  },
];

export const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { hasRole } = useRole(user);

  const visibleTabs = useMemo(() => {
    return tabs.filter((t) => !t.minRole || hasRole(t.minRole));
  }, [hasRole]);

  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [voicesFilter, setVoicesFilter] = useState<Partial<VoiceFilter>>();
  const [analyticsSection, setAnalyticsSection] = useState<AnalyticsSection>();
  const [isMayorOpen, setIsMayorOpen] = useState(false);
  const [mayorRequest, setMayorRequest] = useState<MayorRequest | null>(null);

  const openMayorChat = (context?: string) => {
    setIsMayorOpen(true);
    if (context) {
      setMayorRequest({ context });
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const handleTabChange = (tabId: Tab, filter?: Partial<VoiceFilter>) => {
    if (tabId === "voices") {
      setVoicesFilter(filter);
    }
    if (tabId === "analytics") {
      setAnalyticsSection(undefined);
    }
    setActiveTab(tabId);
    setIsSidebarOpen(false);
  };

  const handleShowAnalytics = (section?: AnalyticsSection) => {
    setAnalyticsSection(section);
    setActiveTab("analytics");
    setIsSidebarOpen(false);
  };

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    window.location.href = "/login";
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
          {tabGroups.map((group) => {
            const groupTabs = visibleTabs.filter((t) => t.group === group.id);
            if (groupTabs.length === 0) {
              return null;
            }
            return (
              <div key={group.id} className="mb-2">
                <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-stone-400 tracking-wider">
                  {group.label}
                </div>
                {groupTabs.map((tab) => (
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
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stone-200 space-y-3">
          {user && (
            <div className="text-xs text-stone-500 truncate">
              {user.username}
            </div>
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
            {visibleTabs.find((t) => t.id === activeTab)?.label}
          </h2>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div key={activeTab} className="animate-fade-in max-w-5xl">
            {activeTab === "home" && (
              <HomePanel
                onNavigate={handleTabChange}
                onShowAnalytics={handleShowAnalytics}
              />
            )}
            {activeTab === "analytics" && (
              <AnalyticsPanel
                onAskMayor={openMayorChat}
                initialSection={analyticsSection}
              />
            )}
            {activeTab === "voices" && (
              <VoicesPanel
                key={JSON.stringify(voicesFilter ?? {})}
                initialFilter={voicesFilter}
                onAskMayor={openMayorChat}
              />
            )}
            {activeTab === "broadcast" && <BroadcastPanel />}
            {activeTab === "poll" && <PollPanel />}
            {activeTab === "knowledge" && <KnowledgePanel />}
            {activeTab === "review" && <ReviewPanel />}
            {activeTab === "feedback" && <FeedbackPanel />}
            {activeTab === "invitations" && <InvitationsPanel />}
            {activeTab === "widget-sites" && <WidgetSitesPanel />}
            {activeTab === "usage" && <UsagePanel />}
          </div>
        </div>
      </main>

      <MayorChatPanel
        isOpen={isMayorOpen}
        request={mayorRequest}
        onClose={() => setIsMayorOpen(false)}
      />
    </div>
  );
};
