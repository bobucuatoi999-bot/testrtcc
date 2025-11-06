import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Calendar, Plus, ArrowRight, Sparkles, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState("");
  const [name, setName] = useState("");

  const handleJoinMeeting = () => {
    if (meetingId.trim() && name.trim()) {
      navigate("/meeting");
    }
  };

  const handleNewMeeting = () => {
    if (name.trim()) {
      navigate("/meeting");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Video className="w-9 h-9 text-primary animate-glow" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              9w.visual
            </h1>
          </div>
          <Button variant="ghost" className="hover:bg-primary/10">Sign In</Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left column - Hero content */}
          <div className="space-y-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Next-gen video meetings</span>
              </div>
              
              <h2 className="text-6xl font-bold leading-tight">
                Premium video
                <br />
                meetings.
                <span className="text-primary"> Now free.</span>
              </h2>
              
              <p className="text-xl text-muted-foreground">
                Crystal clear connections. Zero complexity.
              </p>
            </div>

            <div className="space-y-4 max-w-md">
              <Input
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-lg h-14 bg-card/50 backdrop-blur border-border/50 focus:border-primary transition-all"
              />

              <Button 
                size="lg" 
                className="w-full text-lg h-14 px-8 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all"
                onClick={handleNewMeeting}
                disabled={!name.trim()}
              >
                <Plus className="w-5 h-5 mr-2" />
                Start New Meeting
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or join</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Input
                  placeholder="Meeting ID"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleJoinMeeting()}
                  className="flex-1 h-14 bg-card/50 backdrop-blur border-border/50 focus:border-primary"
                />
                <Button 
                  variant="outline" 
                  size="lg"
                  className="h-14 px-6 border-primary/30 hover:bg-primary/10 hover:border-primary"
                  onClick={handleJoinMeeting}
                  disabled={!meetingId.trim() || !name.trim()}
                >
                  Join <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right column - Features */}
          <div className="space-y-5">
            <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
              <CardContent className="p-7 flex items-center gap-5">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <Video className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-1">4K Video Quality</h3>
                  <p className="text-sm text-muted-foreground">Crystal clear streams</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
              <CardContent className="p-7 flex items-center gap-5">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-1">Unlimited Participants</h3>
                  <p className="text-sm text-muted-foreground">Connect everyone</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
              <CardContent className="p-7 flex items-center gap-5">
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <Shield className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-1">End-to-End Encryption</h3>
                  <p className="text-sm text-muted-foreground">Your privacy matters</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-24 relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-center text-muted-foreground">
            © 2024 9w.visual. Built with precision.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
