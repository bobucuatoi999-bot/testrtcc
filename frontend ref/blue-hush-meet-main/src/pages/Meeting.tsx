import { useState } from "react";
import VideoTile from "@/components/VideoTile";
import ControlBar from "@/components/ControlBar";
import ChatPanel from "@/components/ChatPanel";
import ParticipantsPanel from "@/components/ParticipantsPanel";

const Meeting = () => {
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const participants = [
    { id: "1", name: "You", isMuted: false, isActive: true },
    { id: "2", name: "John Doe", isMuted: false, isActive: false },
    { id: "3", name: "Jane Smith", isMuted: true, isActive: false },
    { id: "4", name: "Mike Johnson", isMuted: false, isActive: false },
    { id: "5", name: "Sarah Williams", isMuted: true, isActive: false },
    { id: "6", name: "Tom Brown", isMuted: false, isActive: false },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-4 pb-24">
          <div className="h-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
            {participants.map((participant) => (
              <VideoTile
                key={participant.id}
                name={participant.name}
                isMuted={participant.isMuted}
                isActive={participant.isActive}
                className="min-h-[200px]"
              />
            ))}
          </div>
        </div>

        {/* Side panels */}
        {showChat && <ChatPanel onClose={() => setShowChat(false)} />}
        {showParticipants && <ParticipantsPanel onClose={() => setShowParticipants(false)} />}
      </div>

      {/* Control bar */}
      <ControlBar
        onToggleChat={() => setShowChat(!showChat)}
        onToggleParticipants={() => setShowParticipants(!showParticipants)}
      />
    </div>
  );
};

export default Meeting;
