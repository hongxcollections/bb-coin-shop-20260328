import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ChatRoomDialog from "@/components/ChatRoomDialog";

/**
 * Direct URL bookmark for /messages/:roomId — opens the chat as a modal Dialog
 * over the Messages list. Closing the dialog navigates back to /messages.
 */
export default function ChatRoom() {
  const params = useParams<{ roomId: string }>();
  const roomId = parseInt(params.roomId, 10);
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: isLoading } = useAuth();
  const [open, setOpen] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation(`/login?from=${encodeURIComponent(`/messages/${roomId}`)}`);
    }
  }, [isLoading, isAuthenticated, roomId, setLocation]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (isNaN(roomId)) {
    setLocation("/messages");
    return null;
  }

  return (
    <>
      <Header />
      <div className="container max-w-2xl mx-auto px-4 py-4 pb-24">
        <p className="text-sm text-gray-500">打開緊對話...</p>
      </div>
      <BottomNav />
      <ChatRoomDialog
        roomId={roomId}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setLocation("/messages");
        }}
      />
    </>
  );
}
