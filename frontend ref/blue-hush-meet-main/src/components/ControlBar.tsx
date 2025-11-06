import { useState } from "react";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  Users, 
  MessageSquare, 
  MoreHorizontal,
  PhoneOff,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ControlBarProps {
  onToggleChat?: () => void;
  onToggleParticipants?: () => void;
}

const ControlBar = ({ onToggleChat, onToggleParticipants }: ControlBarProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-control-bar border-t border-border">
      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                "rounded-lg transition-colors",
                isMuted && "bg-destructive hover:bg-destructive/90 text-white"
              )}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              <span className="ml-2 hidden sm:inline">
                {isMuted ? "Unmute" : "Mute"}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={cn(
                "rounded-lg transition-colors",
                isVideoOff && "bg-destructive hover:bg-destructive/90 text-white"
              )}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              <span className="ml-2 hidden sm:inline">
                {isVideoOff ? "Start Video" : "Stop Video"}
              </span>
            </Button>
          </div>

          {/* Center controls */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="lg" className="rounded-lg">
              <Monitor className="w-5 h-5" />
              <span className="ml-2 hidden md:inline">Share Screen</span>
            </Button>

            <Button variant="ghost" size="lg" className="rounded-lg" onClick={onToggleChat}>
              <MessageSquare className="w-5 h-5" />
              <span className="ml-2 hidden md:inline">Chat</span>
            </Button>

            <Button variant="ghost" size="lg" className="rounded-lg" onClick={onToggleParticipants}>
              <Users className="w-5 h-5" />
              <span className="ml-2 hidden md:inline">Participants</span>
            </Button>

            <Button variant="ghost" size="lg" className="rounded-lg">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-lg">
              <Settings className="w-5 h-5" />
            </Button>
            
            <Button 
              variant="destructive" 
              size="lg"
              className="rounded-lg bg-destructive hover:bg-destructive/90"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="ml-2">Leave</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlBar;
