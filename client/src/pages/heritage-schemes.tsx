import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, DollarSign, Coins, Lock, Check, Info, Plus, Palette } from "lucide-react";
import { doc, runTransaction } from "firebase/firestore";
import { getDbOrThrow } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { HeritagePaintScheme } from "@shared/schema";
import { HERITAGE_CREATION_COST } from "@shared/schema";
import { generateUUID } from "@/lib/uuid";

export default function HeritageSchemesPage() {
  const { playerData, user } = useAuth();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [applyingToLoco, setApplyingToLoco] = useState<string | null>(null);
  
  // Form state for creating new heritage scheme
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrimaryColor, setFormPrimaryColor] = useState("#1e40af");
  const [formSecondaryColor, setFormSecondaryColor] = useState("#fbbf24");
  const [formAccentColor, setFormAccentColor] = useState("#ffffff");
  const [formStripePattern, setFormStripePattern] = useState<"solid" | "striped" | "checkered" | "custom">("striped");

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
  
  const canAccessHeritage = stats.level >= HERITAGE_CREATION_COST.LEVEL_REQUIRED;
  const mySchemes = playerData.heritagePaintSchemes || [];
  const points = stats.points || 0;

  const canAffordCreation = stats.cash >= HERITAGE_CREATION_COST.CASH && points >= HERITAGE_CREATION_COST.POINTS;

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPrimaryColor("#1e40af");
    setFormSecondaryColor("#fbbf24");
    setFormAccentColor("#ffffff");
    setFormStripePattern("striped");
  };

  const handleCreateScheme = async () => {
    if (!user || !playerData || isCreating) return;

    if (!formName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your heritage scheme.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      const db = getDbOrThrow();
      const playerDocRef = doc(db, "players", user.uid);

      await runTransaction(db, async (transaction) => {
        const playerDoc = await transaction.get(playerDocRef);
        if (!playerDoc.exists()) throw new Error("Player document not found");
        
        const currentData = playerDoc.data();
        const currentCash = currentData.stats?.cash || 0;
        const currentPoints = currentData.stats?.points || 0;
        const currentLevel = currentData.stats?.level || 1;
        
        // Validate requirements inside transaction
        if (currentLevel < HERITAGE_CREATION_COST.LEVEL_REQUIRED) {
          throw new Error(`Level ${HERITAGE_CREATION_COST.LEVEL_REQUIRED} required`);
        }
        if (currentCash < HERITAGE_CREATION_COST.CASH) {
          throw new Error(`Insufficient cash. Need $${HERITAGE_CREATION_COST.CASH.toLocaleString()}`);
        }
        if (currentPoints < HERITAGE_CREATION_COST.POINTS) {
          throw new Error(`Insufficient points. Need ${HERITAGE_CREATION_COST.POINTS} points`);
        }
        
        // Create new heritage scheme
        const newScheme: HeritagePaintScheme = {
          id: generateUUID(),
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          primaryColor: formPrimaryColor,
          secondaryColor: formSecondaryColor,
          accentColor: formAccentColor,
          stripePattern: formStripePattern,
          purchaseCost: HERITAGE_CREATION_COST.CASH,
          pointsCost: HERITAGE_CREATION_COST.POINTS,
          levelRequired: HERITAGE_CREATION_COST.LEVEL_REQUIRED,
          isPurchased: true, // Created = owned
          createdAt: Date.now(),
        };

        const updatedSchemes = [...(currentData.heritagePaintSchemes || []), newScheme];

        transaction.update(playerDocRef, {
          heritagePaintSchemes: updatedSchemes,
          "stats.cash": currentCash - HERITAGE_CREATION_COST.CASH,
          "stats.points": currentPoints - HERITAGE_CREATION_COST.POINTS,
        });
      });

      toast({
        title: "🎨 Heritage Scheme Created!",
        description: `${formName} has been created. You can now apply it to any locomotive.`,
      });

      resetForm();
      setCreateDialogOpen(false);
    } catch (error) {
      console.error("Error creating heritage scheme:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create heritage scheme. Please try again.";
      toast({
        title: "Cannot Create Heritage Scheme",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleApplyToLocomotive = async (scheme: HeritagePaintScheme, locoId: string) => {
    if (!user || !playerData || applyingToLoco) return;

    try {
      setApplyingToLoco(locoId);
      const db = getDbOrThrow();
      const playerDocRef = doc(db, "players", user.uid);

      await runTransaction(db, async (transaction) => {
        const playerDoc = await transaction.get(playerDocRef);
        if (!playerDoc.exists()) throw new Error("Player document not found");
        
        const currentData = playerDoc.data();

        // Remove heritage scheme from any other locomotive
        const updatedSchemes = (currentData.heritagePaintSchemes || []).map((s: any) => ({
          ...s,
          appliedToLocoId: s.id === scheme.id ? locoId : s.appliedToLocoId === locoId ? undefined : s.appliedToLocoId,
        }));

        // Update locomotive with heritage scheme
        const updatedLocomotives = (currentData.locomotives || []).map((loco: any) => ({
          ...loco,
          heritagePaintSchemeId: loco.id === locoId ? scheme.id : loco.heritagePaintSchemeId === scheme.id ? undefined : loco.heritagePaintSchemeId,
          specialLiveryId: loco.id === locoId ? undefined : loco.specialLiveryId, // Clear special livery if applying heritage
        }));

        transaction.update(playerDocRef, {
          heritagePaintSchemes: updatedSchemes,
          locomotives: updatedLocomotives,
        });
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
    const isApplied = !!scheme.appliedToLocoId;
    const availableLocos = playerData.locomotives.filter(l => !l.heritagePaintSchemeId && !l.specialLiveryId);

    return (
      <Card key={scheme.id} className="border-2 border-amber-500/50" data-testid={`heritage-scheme-${scheme.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                {scheme.name}
                <Badge variant="default" data-testid={`badge-owned-${scheme.id}`}>Your Design</Badge>
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

          {!isApplied && availableLocos.length > 0 && (
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

          {isApplied && (
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
              Create custom heritage liveries for your locomotives
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
            Heritage paint schemes are unlocked at <strong>Level {HERITAGE_CREATION_COST.LEVEL_REQUIRED}</strong>. You are currently level {stats.level}.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Heritage schemes cost <strong>${HERITAGE_CREATION_COST.CASH.toLocaleString()}</strong> + <strong>{HERITAGE_CREATION_COST.POINTS} points</strong> to create. You design your own colors and name. Each heritage scheme can only be applied to <strong>one locomotive at a time</strong>.
        </AlertDescription>
      </Alert>

      <div className="mb-6">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="lg"
              disabled={!canAccessHeritage || !canAffordCreation}
              data-testid="button-create-heritage"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Heritage Scheme
              {!canAccessHeritage && " (Level " + HERITAGE_CREATION_COST.LEVEL_REQUIRED + " Required)"}
              {canAccessHeritage && !canAffordCreation && " (Cannot Afford)"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Palette className="h-6 w-6 text-amber-500" />
                Create Heritage Paint Scheme
              </DialogTitle>
              <DialogDescription>
                Design your own custom heritage livery. Cost: ${HERITAGE_CREATION_COST.CASH.toLocaleString()} + {HERITAGE_CREATION_COST.POINTS} points
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Scheme Name *</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Blue Streak Heritage"
                  maxLength={50}
                  data-testid="input-heritage-name"
                />
              </div>

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                  data-testid="input-heritage-description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="primary">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary"
                      type="color"
                      value={formPrimaryColor}
                      onChange={(e) => setFormPrimaryColor(e.target.value)}
                      className="w-20 h-10"
                      data-testid="input-primary-color"
                    />
                    <Input
                      type="text"
                      value={formPrimaryColor}
                      onChange={(e) => setFormPrimaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="secondary">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary"
                      type="color"
                      value={formSecondaryColor}
                      onChange={(e) => setFormSecondaryColor(e.target.value)}
                      className="w-20 h-10"
                      data-testid="input-secondary-color"
                    />
                    <Input
                      type="text"
                      value={formSecondaryColor}
                      onChange={(e) => setFormSecondaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="accent">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accent"
                      type="color"
                      value={formAccentColor}
                      onChange={(e) => setFormAccentColor(e.target.value)}
                      className="w-20 h-10"
                      data-testid="input-accent-color"
                    />
                    <Input
                      type="text"
                      value={formAccentColor}
                      onChange={(e) => setFormAccentColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="pattern">Stripe Pattern</Label>
                <Select value={formStripePattern} onValueChange={(val: any) => setFormStripePattern(val)}>
                  <SelectTrigger data-testid="select-stripe-pattern">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="striped">Striped</SelectItem>
                    <SelectItem value="checkered">Checkered</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview */}
              <div>
                <Label>Preview</Label>
                <div
                  className="w-full h-32 rounded border-2 border-border"
                  style={{
                    background: `linear-gradient(135deg, ${formPrimaryColor} 0%, ${formSecondaryColor} 100%)`,
                  }}
                  data-testid="color-preview-create"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateScheme}
                  disabled={isCreating || !formName.trim()}
                  data-testid="button-confirm-create"
                >
                  {isCreating ? "Creating..." : `Create for $${HERITAGE_CREATION_COST.CASH.toLocaleString()} + ${HERITAGE_CREATION_COST.POINTS} pts`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold">
          Your Heritage Schemes ({mySchemes.length})
        </h2>
      </div>

      {mySchemes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mySchemes.map(renderScheme)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Palette className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Heritage Schemes Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first custom heritage livery to get started!
            </p>
            {canAccessHeritage && canAffordCreation && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Scheme
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
