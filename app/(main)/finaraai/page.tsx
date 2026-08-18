import { requireAppUser } from "@/lib/current-user";
import { getChatFolders, getChatThreads, getWatchlist } from "@/lib/db";
import { ChatShell } from "@/components/chat/ChatShell";

export default async function ChatPage() {
  const appUser = await requireAppUser();

  const [threads, folders, watchlist] = await Promise.all([
    getChatThreads(appUser.id),
    getChatFolders(appUser.id),
    getWatchlist(appUser.id),
  ]);

  return <ChatShell initialThreads={threads} initialFolders={folders} watchlist={watchlist} />;
}
