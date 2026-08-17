import { ChatWindow } from "@/components/chat/ChatWindow";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">Chatbot</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Stelle Fragen zu deinem Portfolio, einzelnen Instrumenten oder allgemeinen
          Finanzthemen.
        </p>
      </div>
      <ChatWindow />
      <DisclaimerNote />
    </div>
  );
}
