import { Mic, MicOff, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ParticipantsPanelProps {
  onClose: () => void;
}

interface Participant {
  id: string;
  name: string;
  isMuted: boolean;
  isHost?: boolean;
}

const ParticipantsPanel = ({ onClose }: ParticipantsPanelProps) => {
  const participants: Participant[] = [
    { id: "1", name: "You", isMuted: false, isHost: true },
    { id: "2", name: "John Doe", isMuted: false },
    { id: "3", name: "Jane Smith", isMuted: true },
    { id: "4", name: "Mike Johnson", isMuted: false },
    { id: "5", name: "Sarah Williams", isMuted: true },
  ];

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold">Participants ({participants.length})</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Participants list */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-semibold">
                    {participant.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {participant.name}
                    {participant.isHost && (
                      <span className="ml-2 text-xs text-primary">(Host)</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {participant.isMuted ? (
                  <MicOff className="w-4 h-4 text-destructive" />
                ) : (
                  <Mic className="w-4 h-4 text-muted-foreground" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ParticipantsPanel;
