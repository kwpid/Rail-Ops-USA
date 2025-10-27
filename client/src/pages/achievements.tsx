import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, Target, Gift, Coins, DollarSign, CheckCircle2, Lock, Star } from "lucide-react";
import { doc, runTransaction, increment } from "firebase/firestore";
import { getDbOrThrow, safeUpdateDoc } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Achievement } from "@shared/schema";

export default function AchievementsPage() {
  const { playerData, user } = useAuth();
  const { toast } = useToast();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  if (!playerData) {
    return <div className="p-6">Loading achievements...</div>;
  }

  // Defensive defaults for legacy players without achievements
  const achievements = playerData.achievements || [];
  const weeklyAchievements = achievements.filter(a => a.type === "weekly");
  const careerAchievements = achievements.filter(a => a.type === "career");
  const eventAchievements = achievements.filter(a => a.type === "event");
  
  const stats = playerData.stats || {
    cash: 0,
    xp: 0,
    level: 1,
    nextLocoId: 1,
    points: 0,
    totalJobsCompleted: 0,
  };

  const totalPoints = stats.points || 0;

  const handleClaimReward = async (achievement: Achievement) => {
    if (!user || !playerData || achievement.isCompleted || claimingId) return;

    try {
      setClaimingId(achievement.id);
      const db = getDbOrThrow();
      const playerDocRef = doc(db, "players", user.uid);

      // Use transaction to increment stats based on live Firebase values
      await runTransaction(db, async (transaction) => {
        const playerDoc = await transaction.get(playerDocRef);
        if (!playerDoc.exists()) throw new Error("Player document not found");
        
        const currentData = playerDoc.data();
        const updatedAchievements = (currentData.achievements || []).map((a: any) => 
          a.id === achievement.id 
            ? { ...a, isCompleted: true, completedAt: Date.now() }
            : a
        );

        // Update with increments for points/cash/xp
        transaction.update(playerDocRef, {
          achievements: updatedAchievements,
          "stats.points": increment(achievement.rewards.points),
          "stats.cash": increment(achievement.rewards.cash),
          "stats.xp": increment(achievement.rewards.xp || 0),
        });
      });

      const rewards: string[] = [];
      if (achievement.rewards.cash > 0) rewards.push(`$${achievement.rewards.cash.toLocaleString()}`);
      if (achievement.rewards.points > 0) rewards.push(`${achievement.rewards.points} points`);
      if (achievement.rewards.xp > 0) rewards.push(`${achievement.rewards.xp} XP`);

      toast({
        title: "🎉 Achievement Completed!",
        description: `You earned ${rewards.join(', ')}`,
      });
    } catch (error) {
      console.error("Error claiming reward:", error);
      toast({
        title: "Error",
        description: "Failed to claim reward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClaimingId(null);
    }
  };

  const renderAchievement = (achievement: Achievement) => {
    const progressPercent = Math.min(100, (achievement.currentProgress / achievement.targetValue) * 100);
    const isComplete = achievement.currentProgress >= achievement.targetValue;
    const isClaimed = achievement.isCompleted;

    return (
      <Card key={achievement.id} className={`${isClaimed ? 'opacity-60' : ''}`} data-testid={`achievement-${achievement.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {achievement.title}
                {isClaimed && <CheckCircle2 className="h-5 w-5 text-green-500" data-testid={`achievement-completed-${achievement.id}`} />}
              </CardTitle>
              <CardDescription className="mt-1">{achievement.description}</CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
              {achievement.type === "weekly" && (
                <Badge variant="secondary" className="flex items-center gap-1" data-testid={`badge-weekly-${achievement.id}`}>
                  <Calendar className="h-3 w-3" />
                  Weekly
                </Badge>
              )}
              {achievement.type === "career" && (
                <Badge variant="default" className="flex items-center gap-1" data-testid={`badge-career-${achievement.id}`}>
                  <Trophy className="h-3 w-3" />
                  Career
                </Badge>
              )}
              {achievement.type === "event" && (
                <Badge variant="destructive" className="flex items-center gap-1" data-testid={`badge-event-${achievement.id}`}>
                  <Gift className="h-3 w-3" />
                  Event
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Progress: {achievement.currentProgress} / {achievement.targetValue}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" data-testid={`progress-${achievement.id}`} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-3 text-sm">
                {achievement.rewards.cash > 0 && (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400" data-testid={`reward-cash-${achievement.id}`}>
                    <DollarSign className="h-4 w-4" />
                    ${achievement.rewards.cash.toLocaleString()}
                  </div>
                )}
                {achievement.rewards.points > 0 && (
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400" data-testid={`reward-points-${achievement.id}`}>
                    <Coins className="h-4 w-4" />
                    {achievement.rewards.points} points
                  </div>
                )}
                {achievement.rewards.xp > 0 && (
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400" data-testid={`reward-xp-${achievement.id}`}>
                    <Star className="h-4 w-4" />
                    {achievement.rewards.xp} XP
                  </div>
                )}
              </div>

              {isComplete && !isClaimed && (
                <Button
                  size="sm"
                  onClick={() => handleClaimReward(achievement)}
                  disabled={claimingId === achievement.id}
                  data-testid={`button-claim-${achievement.id}`}
                >
                  {claimingId === achievement.id ? "Claiming..." : "Claim Reward"}
                </Button>
              )}
              {!isComplete && (
                <Button size="sm" variant="outline" disabled data-testid={`button-locked-${achievement.id}`}>
                  <Lock className="h-4 w-4 mr-1" />
                  Locked
                </Button>
              )}
            </div>

            {achievement.expiresAt && (
              <div className="text-xs text-muted-foreground" data-testid={`expires-${achievement.id}`}>
                Expires: {new Date(achievement.expiresAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Target className="h-8 w-8" />
              Achievements & Challenges
            </h1>
            <p className="text-muted-foreground mt-1">
              Complete challenges to earn cash and points
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total Points</div>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2" data-testid="text-total-points">
              <Coins className="h-6 w-6" />
              {totalPoints}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="weekly" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="weekly" className="flex items-center gap-2" data-testid="tab-weekly">
            <Calendar className="h-4 w-4" />
            Weekly ({weeklyAchievements.filter(a => !a.isCompleted).length})
          </TabsTrigger>
          <TabsTrigger value="career" className="flex items-center gap-2" data-testid="tab-career">
            <Trophy className="h-4 w-4" />
            Career ({careerAchievements.filter(a => !a.isCompleted).length})
          </TabsTrigger>
          <TabsTrigger value="event" className="flex items-center gap-2" data-testid="tab-event">
            <Gift className="h-4 w-4" />
            Event ({eventAchievements.filter(a => !a.isCompleted).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4" data-testid="content-weekly">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Challenges</CardTitle>
              <CardDescription>
                Complete these challenges before they reset on Friday at 12 PM
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {weeklyAchievements.map(renderAchievement)}
          </div>
        </TabsContent>

        <TabsContent value="career" className="space-y-4" data-testid="content-career">
          <Card>
            <CardHeader>
              <CardTitle>Career Milestones</CardTitle>
              <CardDescription>
                Permanent achievements that track your overall progress
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {careerAchievements.map(renderAchievement)}
          </div>
        </TabsContent>

        <TabsContent value="event" className="space-y-4" data-testid="content-event">
          <Card>
            <CardHeader>
              <CardTitle>Alpha Challenge Event</CardTitle>
              <CardDescription>
                Special limited-time challenges for alpha testers. Ends December 1st, 2025
              </CardDescription>
            </CardHeader>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {eventAchievements.map(renderAchievement)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
