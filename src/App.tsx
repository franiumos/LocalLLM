import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout";
import { ChatRoute } from "@/app/routes/chat";
import { LibraryRoute } from "@/app/routes/library";
import { ModelsRoute } from "@/app/routes/models";
import { SettingsRoute } from "@/app/routes/settings";
import { Toaster } from "@/components/ui/toast";
import { initEventListeners, cleanupEventListeners } from "@/services/tauri-events";
import { useSettingsStore } from "@/features/settings/stores/settings-store";
import { useChatStore } from "@/features/chat/stores/chat-store";

function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadConversations = useChatStore((s) => s.loadConversations);

  useEffect(() => {
    initEventListeners();
    loadSettings();
    loadConversations();
    return () => {
      cleanupEventListeners();
    };
  }, [loadSettings, loadConversations]);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/chat" element={<ChatRoute />} />
          <Route path="/library" element={<LibraryRoute />} />
          <Route path="/models" element={<ModelsRoute />} />
          <Route path="/settings" element={<SettingsRoute />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </Layout>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
