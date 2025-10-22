import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LOCOMOTIVE_CATALOG, type LocomotiveCatalogItem } from "@shared/schema";
import { Zap, TrendingUp, Gauge, Weight, DollarSign, Lock } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const tierNames = {
  1: "Local Freight",
  2: "Mainline Freight",
  3: "Special Freight",
};

export default function Shop() {
  const { playerData, user, refreshPlayerData } = useAuth();
  const { toast } = useToast();
  const [selectedLoco, setSelectedLoco] = useState<LocomotiveCatalogItem | null>(null);
  const [loading, setLoading] = useState(false);

  if (!playerData || !user) return null;

  const stats = playerData.stats;

  const handlePurchase = async (catalogItem: LocomotiveCatalogItem) => {
    if (stats.cash < catalogItem.purchaseCost) {
      toast({
        title: "Insufficient Funds",
        description: `You need $${catalogItem.purchaseCost.toLocaleString()} to purchase this locomotive.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const playerRef = doc(db, "players", user.uid);
      const nextId = stats.nextLocoId;
      const unitNumber = `#${nextId.toString().padStart(4, "0")}`;

      const newLoco = {
        id: crypto.randomUUID(),
        unitNumber,
        model: catalogItem.model,
        manufacturer: catalogItem.manufacturer,
        tier: catalogItem.tier,
        horsepower: catalogItem.horsepower,
        topSpeed: catalogItem.topSpeed,
        weight: catalogItem.weight,
        tractiveEffort: catalogItem.tractiveEffort,
        fuelCapacity: catalogItem.fuelCapacity,
        fuelEfficiency: catalogItem.fuelEfficiency,
        reliability: catalogItem.reliability,
        maintenanceCost: catalogItem.maintenanceCost,
        purchaseCost: catalogItem.purchaseCost,
        resaleValue: catalogItem.resaleValue,
        scrapValue: Math.floor(catalogItem.purchaseCost * 0.3),
        mileage: 0,
        paintCondition: 100,
        status: "available" as const,
        purchasedAt: Date.now(),
        notes: catalogItem.notes,
      };

      await updateDoc(playerRef, {
        locomotives: [...playerData.locomotives, newLoco],
        "stats.cash": stats.cash - catalogItem.purchaseCost,
        "stats.nextLocoId": nextId + 1,
      });

      await refreshPlayerData();
      setSelectedLoco(null);
      toast({
        title: "Locomotive Purchased!",
        description: `${catalogItem.model} ${unitNumber} added to your fleet`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to purchase locomotive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canAfford = (price: number) => stats.cash >= price;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-accent font-bold">Locomotive Shop</h1>
        <p className="text-muted-foreground">
          Purchase locomotives to expand your fleet
        </p>
      </div>

      {/* Tier 1 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-accent font-semibold">Tier 1: Local Freight</h2>
          <Badge>Unlocked</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LOCOMOTIVE_CATALOG.filter((l) => l.tier === 1).map((loco, idx) => (
            <Card
              key={idx}
              className="hover-elevate cursor-pointer"
              onClick={() => setSelectedLoco(loco)}
              data-testid={`card-shop-loco-${idx}`}
            >
              <CardHeader>
                <CardTitle className="text-lg">{loco.model}</CardTitle>
                <CardDescription>{loco.manufacturer}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.horsepower} HP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.topSpeed} MPH</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.reliability}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Weight className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.weight} tons</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xl font-bold">
                    ${loco.purchaseCost.toLocaleString()}
                  </span>
                  <Badge variant={canAfford(loco.purchaseCost) ? "default" : "secondary"}>
                    {canAfford(loco.purchaseCost) ? "Can Afford" : "Too Expensive"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Tier 2 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-accent font-semibold">Tier 2: Mainline Freight</h2>
          {stats.level >= 10 ? (
            <Badge>Unlocked</Badge>
          ) : (
            <Badge variant="secondary">
              <Lock className="w-3 h-3 mr-1" />
              Level 10
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LOCOMOTIVE_CATALOG.filter((l) => l.tier === 2).map((loco, idx) => (
            <Card
              key={idx}
              className={stats.level >= 10 ? "hover-elevate cursor-pointer" : "opacity-50"}
              onClick={() => stats.level >= 10 && setSelectedLoco(loco)}
              data-testid={`card-shop-loco-tier2-${idx}`}
            >
              <CardHeader>
                <CardTitle className="text-lg">{loco.model}</CardTitle>
                <CardDescription>{loco.manufacturer}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.horsepower} HP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.topSpeed} MPH</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.reliability}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Weight className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.weight} tons</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xl font-bold">
                    ${loco.purchaseCost.toLocaleString()}
                  </span>
                  {stats.level >= 10 && (
                    <Badge variant={canAfford(loco.purchaseCost) ? "default" : "secondary"}>
                      {canAfford(loco.purchaseCost) ? "Can Afford" : "Too Expensive"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Tier 3 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-accent font-semibold">Tier 3: Special Freight</h2>
          {stats.level >= 50 ? (
            <Badge>Unlocked</Badge>
          ) : (
            <Badge variant="secondary">
              <Lock className="w-3 h-3 mr-1" />
              Level 50
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LOCOMOTIVE_CATALOG.filter((l) => l.tier === 3).map((loco, idx) => (
            <Card
              key={idx}
              className={stats.level >= 50 ? "hover-elevate cursor-pointer" : "opacity-50"}
              onClick={() => stats.level >= 50 && setSelectedLoco(loco)}
              data-testid={`card-shop-loco-tier3-${idx}`}
            >
              <CardHeader>
                <CardTitle className="text-lg">{loco.model}</CardTitle>
                <CardDescription>{loco.manufacturer}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.horsepower} HP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.topSpeed} MPH</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.reliability}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Weight className="w-3 h-3 text-muted-foreground" />
                    <span>{loco.weight} tons</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xl font-bold">
                    ${loco.purchaseCost.toLocaleString()}
                  </span>
                  {stats.level >= 50 && (
                    <Badge variant={canAfford(loco.purchaseCost) ? "default" : "secondary"}>
                      {canAfford(loco.purchaseCost) ? "Can Afford" : "Too Expensive"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Purchase Dialog */}
      <Dialog open={!!selectedLoco} onOpenChange={(open) => !open && setSelectedLoco(null)}>
        <DialogContent className="max-w-2xl">
          {selectedLoco && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-accent">
                  {selectedLoco.model}
                </DialogTitle>
                <DialogDescription>{selectedLoco.manufacturer}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Horsepower</Label>
                    <div className="font-semibold">{selectedLoco.horsepower} HP</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Top Speed</Label>
                    <div className="font-semibold">{selectedLoco.topSpeed} MPH</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Weight</Label>
                    <div className="font-semibold">{selectedLoco.weight} tons</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Reliability</Label>
                    <div className="font-semibold">{selectedLoco.reliability}%</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Fuel Capacity</Label>
                    <div className="font-semibold">{selectedLoco.fuelCapacity} gal</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Maintenance</Label>
                    <div className="font-semibold">${selectedLoco.maintenanceCost}/mi</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="text-sm">{selectedLoco.notes}</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                  <div>
                    <div className="text-sm text-muted-foreground">Purchase Price</div>
                    <div className="text-2xl font-bold">
                      ${selectedLoco.purchaseCost.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Your Cash</div>
                    <div className="text-2xl font-bold">
                      ${stats.cash.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedLoco(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handlePurchase(selectedLoco)}
                  disabled={loading || !canAfford(selectedLoco.purchaseCost)}
                  data-testid="button-confirm-purchase"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Purchase
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
