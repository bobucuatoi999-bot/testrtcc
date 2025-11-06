import { Mic, MicOff, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoTileProps {
  name: string;
  isMuted?: boolean;
  isActive?: boolean;
  className?: string;
}

const VideoTile = ({ name, isMuted = false, isActive = false, className }: VideoTileProps) => {
  return (
    <div 
      className={cn(
        "relative bg-video-bg rounded-lg overflow-hidden transition-all duration-200 group",
        isActive && "ring-2 ring-primary",
        className
      )}
    >
      {/* Simulated video content - will be replaced with actual video */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-3xl font-semibold text-foreground">
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Name tag */}
      <div className="absolute bottom-2 left-2 bg-black/70 px-3 py-1 rounded-md flex items-center gap-2">
        <span className="text-sm text-white font-medium">{name}</span>
        {isMuted ? (
          <MicOff className="w-4 h-4 text-destructive" />
        ) : (
          <Mic className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-2 bg-black/70 rounded-md hover:bg-black/80 transition-colors">
          <Maximize2 className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
};

export default VideoTile;
