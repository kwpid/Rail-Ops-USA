import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Train, Gauge, Fuel, Zap, Weight, TrendingUp, Settings2, DollarSign } from "lucide-react";
import type { Locomotive } from "@shared/schema";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Inventory() {
  const { playerData, user, refreshPlayerData } = useAuth();
  const { toast } = useToast();
  const [selectedLoco, setSelectedLoco] = useState<Locomotive | null>(null);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [newUnitNumber, setNewUnitNumber] = useState("");
  const [loading, setLoading] = useState(false);

  if (!playerData || !user) return null;

  const locomotives = playerData.locomotives;

  const handleSell = async (loco: Locomotive) => {
    if (!confirm(`Sell ${loco.model} ${loco.unitNumber} for $${loco.resaleValue.toLocaleString()}?`)) return;

    setLoading(true);
    try {
      const playerRef = doc(db, "players", user.uid);
      const updatedLocos = locomotives.filter((l) => l.id !== loco.id);
      const newCash = playerData.stats.cash + loco.resaleValue;

      await updateDoc(playerRef, {
        locomotives: updatedLocos,
        "stats.cash": newCash,
      });

      await refreshPlayerData();
      setSelectedLoco(null);
      toast({
        title: "Locomotive Sold",
        description: `Sold for $${loco.resaleValue.toLocaleString()}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to sell locomotive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScrap = async (loco: Locomotive) => {
    if (!confirm(`Scrap ${loco.model} ${loco.unitNumber} for $${loco.scrapValue.toLocaleString()}? This cannot be undone.`)) return;

    setLoading(true);
    try {
      const playerRef = doc(db, "players", user.uid);
      const updatedLocos = locomotives.filter((l) => l.id !== loco.id);
      const newCash = playerData.stats.cash + loco.scrapValue;

      await updateDoc(playerRef, {
        locomotives: updatedLocos,
        "stats.cash": newCash,
      });

      await refreshPlayerData();
      setSelectedLoco(null);
      toast({
        title: "Locomotive Scrapped",
        description: `Received $${loco.scrapValue.toLocaleString()}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to scrap locomotive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!selectedLoco || !newUnitNumber.startsWith("#")) {
      toast({
        title: "Invalid Unit Number",
        description: "Unit number must start with #",
        variant: "destructive",
      });
      return;
    }

    if (locomotives.some((l) => l.unitNumber === newUnitNumber && l.id !== selectedLoco.id)) {
      toast({
        title: "Duplicate Unit Number",
        description: "This unit number is already in use",
        variant: "destructive",
      });
      return;
    }

    if (playerData.stats.cash < 10000) {
      toast({
        title: "Insufficient Funds",
        description: "Renaming costs $10,000",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const playerRef = doc(db, "players", user.uid);
      const updatedLocos = locomotives.map((l) =>
        l.id === selectedLoco.id ? { ...l, unitNumber: newUnitNumber } : l
      );

      await updateDoc(playerRef, {
        locomotives: updatedLocos,
        "stats.cash": playerData.stats.cash - 10000,
      });

      await refreshPlayerData();
      setCustomizeMode(false);
      setSelectedLoco(null);
      toast({
        title: "Unit Renamed",
        description: `New unit number: ${newUnitNumber}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to rename unit",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-accent font-bold">Locomotive Inventory</h1>
        <p className="text-muted-foreground">
          Manage your fleet of {locomotives.length} locomotive{locomotives.length !== 1 ? "s" : ""}
        </p>
      </div>

      {locomotives.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Train className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No Locomotives</h3>
              <p className="text-sm text-muted-foreground">
                Visit the shop to purchase your first locomotive
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locomotives.map((loco) => (
            <Card
              key={loco.id}
              className="hover-elevate cursor-pointer"
              onClick={() => setSelectedLoco(loco)}
              data-testid={`card-loco-${loco.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{loco.model}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {loco.manufacturer}
                    </p>
                  </div>
                  <Badge variant={loco.status === "available" ? "default" : "secondary"}>
                    {loco.status}
                  </Badge>
                </div>
                <div className="font-mono text-xl font-bold text-primary">
                  {loco.unitNumber}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLoco && !customizeMode} onOpenChange={(open) => !open && setSelectedLoco(null)}>
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
                <div className="flex items-center justify-between">
                  <div className="font-mono text-2xl font-bold text-primary">
                    {selectedLoco.unitNumber}
                  </div>
                  <Badge variant={selectedLoco.status === "available" ? "default" : "secondary"}>
                    {selectedLoco.status}
                  </Badge>
                </div>

                <Separator />

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
                    <Label className="text-muted-foreground">Tractive Effort</Label>
                    <div className="font-semibold">{selectedLoco.tractiveEffort.toLocaleString()} lbs</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Fuel Capacity</Label>
                    <div className="font-semibold">{selectedLoco.fuelCapacity} gal</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Fuel Efficiency</Label>
                    <div className="font-semibold">{selectedLoco.fuelEfficiency} GPH</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Reliability</Label>
                    <div className="font-semibold">{selectedLoco.reliability}%</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Maintenance Cost</Label>
                    <div className="font-semibold">${selectedLoco.maintenanceCost}/mi</div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Resale Value</Label>
                    <div className="font-semibold">${selectedLoco.resaleValue.toLocaleString()}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Scrap Value</Label>
                    <div className="font-semibold">${selectedLoco.scrapValue.toLocaleString()}</div>
                  </div>
                </div>

                {selectedLoco.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="text-sm">{selectedLoco.notes}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setCustomizeMode(true);
                      setNewUnitNumber(selectedLoco.unitNumber);
                    }}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-customize"
                  >
                    <Settings2 className="w-4 h-4 mr-2" />
                    Customize
                  </Button>
                  <Button
                    onClick={() => handleSell(selectedLoco)}
                    variant="outline"
                    disabled={loading || selectedLoco.status !== "available"}
                    className="flex-1"
                    data-testid="button-sell"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Sell
                  </Button>
                  <Button
                    onClick={() => handleScrap(selectedLoco)}
                    variant="destructive"
                    disabled={loading || selectedLoco.status !== "available"}
                    data-testid="button-scrap"
                  >
                    Scrap
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Customize Dialog */}
      <Dialog open={customizeMode} onOpenChange={(open) => !open && setCustomizeMode(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customize Locomotive</DialogTitle>
            <DialogDescription>
              Change unit number for $10,000
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit-number">Unit Number</Label>
              <Input
                id="unit-number"
                value={newUnitNumber}
                onChange={(e) => setNewUnitNumber(e.target.value)}
                placeholder="#0001"
                className="font-mono"
                data-testid="input-unit-number"
              />
              <p className="text-xs text-muted-foreground">
                Must start with # and be unique
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCustomizeMode(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRename}
                disabled={loading || !newUnitNumber || newUnitNumber === selectedLoco?.unitNumber}
                className="flex-1"
                data-testid="button-confirm-rename"
              >
                Confirm ($10,000)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
