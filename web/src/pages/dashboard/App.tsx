import { useState } from "react";
import { EmergencyPanel } from "./components/EmergencyPanel";
import { KnowledgePanel } from "./components/KnowledgePanel";
import { PersonaPanel } from "./components/PersonaPanel";

type Tab = "knowledge" | "persona" | "emergency";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "knowledge",
    label: "ナレッジ",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
  },
  {
    id: "persona",
    label: "ペルソナ",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    id: "emergency",
    label: "緊急情報",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
];

export const App = () => {
  const [activeTab, setActiveTab] = useState<Tab>("knowledge");

  return (
    <div className="min-h-dvh bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
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
            <a
              href="/"
              className="text-sm text-teal-700 hover:text-teal-800 hover:underline"
            >
              チャットへ戻る
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Tab Navigation */}
        <nav className="flex gap-1 p-1 bg-stone-100 rounded-lg mb-6 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md
                transition-colors duration-150
                ${
                  activeTab === tab.id
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-stone-600 hover:text-stone-800 hover:bg-stone-50"
                }
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Main Content */}
        <main key={activeTab} className="animate-fade-in">
          {activeTab === "knowledge" && <KnowledgePanel />}
          {activeTab === "persona" && <PersonaPanel />}
          {activeTab === "emergency" && <EmergencyPanel />}
        </main>
      </div>
    </div>
  );
};
