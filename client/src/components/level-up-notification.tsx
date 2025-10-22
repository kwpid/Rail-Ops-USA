import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Sparkles } from "lucide-react";

interface LevelUpNotificationProps {
  level: number;
  unlocks: string[];
  onClose: () => void;
}

export function LevelUpNotification({ level, unlocks, onClose }: LevelUpNotificationProps) {
  useEffect(() => {
    // Auto-close after 5 seconds
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in">
      <Card className="w-full max-w-md shadow-2xl animate-in zoom-in-95">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Trophy className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-4xl font-accent font-bold">
              Level Up!
            </CardTitle>
            <div className="text-6xl font-accent font-bold text-primary mt-2">
              {level}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {unlocks.length > 0 && (
            <div className="p-4 bg-primary/10 rounded-md space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="w-4 h-4" />
                New Unlocks
              </div>
              <div className="space-y-2">
                {unlocks.map((unlock, idx) => (
                  <Badge key={idx} variant="default" className="text-sm">
                    {unlock}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={onClose}
            className="w-full"
            size="lg"
            data-testid="button-close-levelup"
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
