import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, DollarSign, Coins, Lock, Check, Info } from "lucide-react";
import { doc } from "firebase/firestore";
import { getDbOrThrow, safeUpdateDoc } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { HeritagePaintScheme } from "@shared/schema";

export default function HeritageSchemesPage() {
  const { playerData, user } = useAuth();
  const { toast } = useToast();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [applyingToLoco, setApplyingToLoco] = useState<string | null>(null);

  if (!playerData) {
    return <div className="p-6">Loading heritage paint schemes...</div>;
  }

  const stats = playerData.stats || {
    cash: 0,
    xp: 0,
    level: 1,
    nextLocoId: 1,
    points: 0,
    totalJobsCompleted: 0,
  };
  
  const canAccessHeritage = stats.level >= 25;
  // Defensive defaults for legacy players without heritage schemes
  const availableSchemes = playerData.heritagePaintSchemes || [];
  const purchasedSchemes = availableSchemes.filter(s => s.isPurchased);
  const points = stats.points || 0;

  const handlePurchase = async (scheme: HeritagePaintScheme) => {
    if (!user || !playerData || purchasingId) return;

    if (stats.level < scheme.levelRequired) {
      toast({
        title: "Level Required",
        description: `You need to reach level ${scheme.levelRequired} to purchase this heritage scheme.`,
        variant: "destructive",
      });
      return;
    }

    if (stats.cash < scheme.purchaseCost) {
      toast({
        title: "Insufficient Funds",
        description: `You need $${scheme.purchaseCost.toLocaleString()} to purchase this scheme.`,
        variant: "destructive",
      });
      return;
    }

    if (points < scheme.pointsCost) {
      toast({
        title: "Insufficient Points",
        description: `You need ${scheme.pointsCost} points to purchase this scheme.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setPurchasingId(scheme.id);
      const db = getDbOrThrow();
      const playerDocRef = doc(db, "players", user.uid);

      const updatedSchemes = playerData.heritagePaintSchemes.map(s =>
        s.id === scheme.id ? { ...s, isPurchased: true } : s
      );

      await safeUpdateDoc(playerDocRef, {
        heritagePaintSchemes: updatedSchemes,
        "stats.cash": stats.cash - scheme.purchaseCost,
        "stats.points": points - scheme.pointsCost,
      });

      toast({
        title: "🎨 Heritage Scheme Purchased!",
        description: `${scheme.name} is now available. Apply it to any locomotive from your inventory.`,
      });
    } catch (error) {
      console.error("Error purchasing heritage scheme:", error);
      toast({
        title: "Error",
        description: "Failed to purchase heritage scheme. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPurchasingId(null);
    }
  };

  const handleApplyToLocomotive = async (scheme: HeritagePaintScheme, locoId: string) => {
    if (!user || !playerData || applyingToLoco) return;

    try {
      setApplyingToLoco(locoId);
      const db = getDbOrThrow();
      const playerDocRef = doc(db, "players", user.uid);

      // Remove heritage scheme from any other locomotive
      const updatedSchemes = playerData.heritagePaintSchemes.map(s => ({
        ...s,
        appliedToLocoId: s.id === scheme.id ? locoId : s.appliedToLocoId === locoId ? undefined : s.appliedToLocoId,
      }));

      // Update locomotive with heritage scheme
      const updatedLocomotives = playerData.locomotives.map(loco => ({
        ...loco,
        heritagePaintSchemeId: loco.id === locoId ? scheme.id : loco.heritagePaintSchemeId === scheme.id ? undefined : loco.heritagePaintSchemeId,
      }));

      await safeUpdateDoc(playerDocRef, {
        heritagePaintSchemes: updatedSchemes,
        locomotives: updatedLocomotives,
      });

      toast({
        title: "Heritage Scheme Applied!",
        description: `${scheme.name} has been applied to your locomotive.`,
      });
    } catch (error) {
      console.error("Error applying heritage scheme:", error);
      toast({
        title: "Error",
        description: "Failed to apply heritage scheme. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApplyingToLoco(null);
    }
  };

  const renderScheme = (scheme: HeritagePaintScheme) => {
    const isPurchased = scheme.isPurchased;
    const isApplied = !!scheme.appliedToLocoId;
    const canAfford = stats.cash >= scheme.purchaseCost && stats.points >= scheme.pointsCost;
    const meetsLevel = stats.level >= scheme.levelRequired;
    const availableLocos = playerData.locomotives.filter(l => !l.heritagePaintSchemeId);

    return (
      <Card
        key={scheme.id}
        className={`${isPurchased ? 'border-2 border-amber-500/50' : ''}`}
        data-testid={`heritage-scheme-${scheme.id}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                {scheme.name}
                {isPurchased && <Badge variant="default" data-testid={`badge-owned-${scheme.id}`}>Owned</Badge>}
                {isApplied && <Badge variant="secondary" data-testid={`badge-applied-${scheme.id}`}>Applied</Badge>}
              </CardTitle>
              {scheme.description && (
                <CardDescription className="mt-1">{scheme.description}</CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Color Preview */}
          <div className="flex gap-2">
            <div
              className="w-full h-20 rounded border-2 border-border"
              style={{
                background: `linear-gradient(135deg, ${scheme.primaryColor} 0%, ${scheme.secondaryColor} 100%)`,
              }}
              data-testid={`color-preview-${scheme.id}`}
            />
          </div>

          {/* Requirements & Pricing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Level Required:</span>
              <span className={meetsLevel ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                Level {scheme.levelRequired} {meetsLevel && <Check className="inline h-4 w-4" />}
              </span>
            </div>
            
            {!isPurchased && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Cash Cost:
                  </span>
                  <span className={stats.cash >= scheme.purchaseCost ? "" : "text-red-600 dark:text-red-400"} data-testid={`cost-cash-${scheme.id}`}>
                    ${scheme.purchaseCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Coins className="h-4 w-4" />
                    Points Cost:
                  </span>
                  <span className={stats.points >= scheme.pointsCost ? "" : "text-red-600 dark:text-red-400"} data-testid={`cost-points-${scheme.id}`}>
                    {scheme.pointsCost} points
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          {!isPurchased && (
            <Button
              className="w-full"
              onClick={() => handlePurchase(scheme)}
              disabled={!canAfford || !meetsLevel || purchasingId === scheme.id}
              data-testid={`button-purchase-${scheme.id}`}
            >
              {purchasingId === scheme.id ? (
                "Purchasing..."
              ) : !meetsLevel ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Level {scheme.levelRequired} Required
                </>
              ) : !canAfford ? (
                "Cannot Afford"
              ) : (
                `Purchase for $${scheme.purchaseCost.toLocaleString()} + ${scheme.pointsCost} pts`
              )}
            </Button>
          )}

          {isPurchased && !isApplied && availableLocos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Apply to locomotive:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {availableLocos.slice(0, 5).map(loco => (
                  <Button
                    key={loco.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleApplyToLocomotive(scheme, loco.id)}
                    disabled={applyingToLoco === loco.id}
                    data-testid={`button-apply-${scheme.id}-${loco.id}`}
                  >
                    {loco.unitNumber} - {loco.model}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {isPurchased && isApplied && (
            <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2" data-testid={`text-applied-${scheme.id}`}>
              <Check className="h-4 w-4" />
              Applied to {playerData.locomotives.find(l => l.id === scheme.appliedToLocoId)?.unitNumber}
            </div>
          )}
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
              <Sparkles className="h-8 w-8 text-amber-500" />
              Heritage Paint Schemes
            </h1>
            <p className="text-muted-foreground mt-1">
              Exclusive paint schemes with special styling for your locomotives
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Your Points</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2" data-testid="text-user-points">
              <Coins className="h-5 w-5" />
              {stats.points}
            </div>
          </div>
        </div>
      </div>

      {!canAccessHeritage && (
        <Alert className="mb-6">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Heritage paint schemes are unlocked at <strong>Level 25</strong>. You are currently level {stats.level}.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Heritage schemes can only be applied to <strong>one locomotive at a time</strong>. Locomotives with heritage schemes display special gradient animations and styling.
        </AlertDescription>
      </Alert>

      <div className="mb-4">
        <h2 className="text-xl font-semibold">
          Purchased Schemes ({purchasedSchemes.length})
        </h2>
      </div>

      {purchasedSchemes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {purchasedSchemes.map(renderScheme)}
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-xl font-semibold">
          Available Schemes ({availableSchemes.filter(s => !s.isPurchased).length})
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {availableSchemes.filter(s => !s.isPurchased).map(renderScheme)}
      </div>
    </div>
  );
}
