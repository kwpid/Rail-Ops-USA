import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LOCOMOTIVE_CATALOG, generateUsedLocomotive, type UsedLocomotiveItem, PAINT_COSTS } from "@shared/schema";
import { Zap, TrendingUp, Gauge, Weight, DollarSign, Search, Filter, Paintbrush, AlertTriangle, Tag, Wrench } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { getDbOrThrow } from "@/lib/firebase";

export default function LoanerTrains() {
  const { playerData, user, refreshPlayerData } = useAuth();
  const { toast } = useToast();
  const [selectedUsedLoco, setSelectedUsedLoco] = useState<UsedLocomotiveItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState<"all" | "Local / Yard" | "Long Haul">("all");
  const [sortBy, setSortBy] = useState<"price" | "hp" | "condition">("price");
  const [purchaseOption, setPurchaseOption] = useState<"as-is" | "repaint" | "patch">("as-is");
  const [selectedPaintScheme, setSelectedPaintScheme] = useState<string | null>(null);

  if (!playerData || !user) return null;

  const stats = playerData.stats;
  const company = playerData.company;
  const paintSchemes = playerData.paintSchemes || [];

  const usedLocomotives = useMemo(() => {
    let used = LOCOMOTIVE_CATALOG.map(loco => generateUsedLocomotive(loco)).filter((loco) => {
      const matchesSearch = 
        loco.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loco.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loco.previousOwner.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTag = filterTag === "all" || loco.tags.includes(filterTag);
      
      return matchesSearch && matchesTag;
    });

    used.sort((a, b) => {
      if (sortBy === "price") return a.usedPrice - b.usedPrice;
      if (sortBy === "hp") return b.horsepower - a.horsepower;
      if (sortBy === "condition") return b.health - a.health;
      return a.model.localeCompare(b.model);
    });

    return used;
  }, [searchQuery, filterTag, sortBy]);

  const handleUsedPurchase = async (usedItem: UsedLocomotiveItem) => {
    let totalCost = usedItem.usedPrice;
    
    // Calculate paint costs
    if (purchaseOption === "repaint") {
      if (!selectedPaintScheme) {
        toast({
          title: "Select Paint Scheme",
          description: "Please select a paint scheme for repainting.",
          variant: "destructive",
        });
        return;
      }
      totalCost += PAINT_COSTS.SINGLE_LOCO;
    } else if (purchaseOption === "patch") {
      totalCost += PAINT_COSTS.PATCH_COST;
    }

    if (stats.cash < totalCost) {
      toast({
        title: "Insufficient Funds",
        description: `You need $${totalCost.toLocaleString()} total (Locomotive: $${usedItem.usedPrice.toLocaleString()}${purchaseOption === "repaint" ? `, Repaint: $${PAINT_COSTS.SINGLE_LOCO.toLocaleString()}` : purchaseOption === "patch" ? `, Patch: $${PAINT_COSTS.PATCH_COST.toLocaleString()}` : ""})`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const db = getDbOrThrow();
      const playerRef = doc(db, "players", user.uid);
      const nextId = stats.nextLocoId;
      const unitNumber = `#${nextId.toString().padStart(4, "0")}`;
      const now = Date.now();

      const newLoco: any = {
        id: crypto.randomUUID(),
        unitNumber,
        model: usedItem.model,
        manufacturer: usedItem.manufacturer,
        tier: usedItem.tier,
        tags: usedItem.tags,
        horsepower: usedItem.horsepower,
        topSpeed: usedItem.topSpeed,
        weight: usedItem.weight,
        tractiveEffort: usedItem.tractiveEffort,
        fuelCapacity: usedItem.fuelCapacity,
        fuelEfficiency: usedItem.fuelEfficiency,
        reliability: usedItem.reliability,
        maintenanceCost: usedItem.maintenanceCost,
        purchaseCost: usedItem.usedPrice,
        resaleValue: Math.floor(usedItem.usedPrice * 0.7),
        scrapValue: Math.floor(usedItem.usedPrice * 0.3),
        mileage: usedItem.mileage,
        health: usedItem.health,
        paintCondition: purchaseOption === "as-is" ? 60 : 100,
        previousOwnerName: usedItem.previousOwner,
        isUsed: true,
        purchasedAt: now,
        notes: usedItem.notes,
      };

      // Handle paint options
      if (purchaseOption === "repaint") {
        newLoco.status = "in_paint_shop";
        newLoco.paintCompleteAt = now + (PAINT_COSTS.DOWNTIME_MINUTES * 60 * 1000);
        newLoco.paintSchemeId = selectedPaintScheme;
        newLoco.isPatched = false;
        delete newLoco.previousOwnerName;
      } else if (purchaseOption === "patch") {
        newLoco.status = "in_paint_shop";
        newLoco.paintCompleteAt = now + (PAINT_COSTS.PATCH_DOWNTIME_MINUTES * 60 * 1000);
        newLoco.isPatched = true;
      } else {
        newLoco.status = "available";
      }

      await updateDoc(playerRef, {
        locomotives: [...playerData.locomotives, newLoco],
        "stats.cash": stats.cash - totalCost,
        "stats.nextLocoId": nextId + 1,
      });

      await refreshPlayerData();
      setSelectedUsedLoco(null);
      setPurchaseOption("as-is");
      setSelectedPaintScheme(null);
      
      let description = `${usedItem.model} (${usedItem.mileage.toLocaleString()} mi, ${usedItem.health}% health) added to your fleet for $${totalCost.toLocaleString()}`;
      if (purchaseOption === "repaint") {
        description += ` - Will be repainted in ${PAINT_COSTS.DOWNTIME_MINUTES} minutes`;
      } else if (purchaseOption === "patch") {
        description += ` - Paint patching in ${PAINT_COSTS.PATCH_DOWNTIME_MINUTES} minutes`;
      }
      
      toast({
        title: "Used Locomotive Purchased!",
        description,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to purchase used locomotive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canAfford = (price: number) => stats.cash >= price;

  const getConditionColor = (health: number) => {
    if (health >= 75) return "text-chart-3";
    if (health >= 50) return "text-chart-2";
    if (health >= 30) return "text-chart-1";
    return "text-destructive";
  };

  const getConditionBadge = (health: number, needsRepair: boolean) => {
    if (needsRepair) return <Badge variant="destructive">Needs Repair</Badge>;
    if (health >= 75) return <Badge variant="default">Good Condition</Badge>;
    if (health >= 50) return <Badge variant="secondary">Fair Condition</Badge>;
    return <Badge variant="outline">Poor Condition</Badge>;
  };

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-4xl font-bold font-accent mb-2" data-testid="text-title">
          Loaner Trains & Train Market
        </h1>
        <p className="text-muted-foreground">
          Purchase pre-owned locomotives at discounted prices. All units come with service history and can be repainted or patched.
        </p>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter & Sort
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Model, manufacturer, or previous owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Filter by Type</Label>
              <Select value={filterTag} onValueChange={(v: any) => setFilterTag(v)}>
                <SelectTrigger data-testid="select-filter-tag">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Local / Yard">Local / Yard</SelectItem>
                  <SelectItem value="Long Haul">Long Haul</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sort By</Label>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger data-testid="select-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Price (Low to High)</SelectItem>
                  <SelectItem value="hp">Horsepower (High to Low)</SelectItem>
                  <SelectItem value="condition">Condition (Best First)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Used Locomotives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {usedLocomotives.map((loco, idx) => (
          <Card
            key={idx}
            className="hover-elevate cursor-pointer"
            onClick={() => setSelectedUsedLoco(loco)}
            data-testid={`card-used-loco-${idx}`}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">{loco.model}</CardTitle>
                  <CardDescription>{loco.manufacturer}</CardDescription>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {loco.tags.map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                {getConditionBadge(loco.health, loco.needsRepair)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Previous Owner:</span>
                  <span className="font-medium">{loco.previousOwner}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mileage:</span>
                  <span className="font-mono">{loco.mileage.toLocaleString()} mi</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Health:</span>
                  <span className={`font-semibold ${getConditionColor(loco.health)}`}>
                    {loco.health}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-muted-foreground" />
                  <span>{loco.horsepower} HP</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-muted-foreground" />
                  <span>{loco.topSpeed} MPH</span>
                </div>
                <div className="flex items-center gap-1">
                  <Weight className="w-3 h-3 text-muted-foreground" />
                  <span>{loco.weight} tons</span>
                </div>
                <div className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-muted-foreground" />
                  <span>{loco.reliability}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <div className="text-xl font-bold">
                    ${loco.usedPrice.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground line-through">
                    ${loco.purchaseCost.toLocaleString()} new
                  </div>
                </div>
                <Badge variant={canAfford(loco.usedPrice) ? "default" : "secondary"}>
                  {canAfford(loco.usedPrice) ? "Can Afford" : "Too Expensive"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Purchase Dialog */}
      <Dialog open={!!selectedUsedLoco} onOpenChange={(open) => !open && setSelectedUsedLoco(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedUsedLoco && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-accent flex items-center gap-2">
                  {selectedUsedLoco.model}
                  {selectedUsedLoco.needsRepair && (
                    <Badge variant="destructive" className="ml-2">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Needs Repair
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>{selectedUsedLoco.manufacturer}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Previous Owner Info */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Service History
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Previous Owner</Label>
                      <div className="font-semibold">{selectedUsedLoco.previousOwner}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Total Mileage</Label>
                      <div className="font-mono">{selectedUsedLoco.mileage.toLocaleString()} mi</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Current Health</Label>
                      <div className={`font-semibold ${getConditionColor(selectedUsedLoco.health)}`}>
                        {selectedUsedLoco.health}%
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Paint Condition</Label>
                      <div className="font-semibold">Worn</div>
                    </div>
                  </div>
                </div>

                {/* Specifications */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Horsepower</Label>
                    <div className="font-semibold">{selectedUsedLoco.horsepower} HP</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Top Speed</Label>
                    <div className="font-semibold">{selectedUsedLoco.topSpeed} MPH</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Weight</Label>
                    <div className="font-semibold">{selectedUsedLoco.weight} tons</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Reliability</Label>
                    <div className="font-semibold">{selectedUsedLoco.reliability}%</div>
                  </div>
                </div>

                <Separator />

                {/* Paint Options */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Paintbrush className="w-4 h-4" />
                    Paint Options
                  </h3>
                  
                  <div className="space-y-3">
                    <div 
                      className={`p-3 border rounded-lg cursor-pointer ${purchaseOption === "as-is" ? "border-primary bg-primary/5" : "border-border"}`}
                      onClick={() => setPurchaseOption("as-is")}
                      data-testid="option-as-is"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Purchase As-Is</div>
                          <div className="text-sm text-muted-foreground">
                            Keep {selectedUsedLoco.previousOwner} paint scheme
                          </div>
                        </div>
                        <div className="font-mono font-bold">
                          +$0
                        </div>
                      </div>
                    </div>

                    <div 
                      className={`p-3 border rounded-lg cursor-pointer ${purchaseOption === "patch" ? "border-primary bg-primary/5" : "border-border"}`}
                      onClick={() => setPurchaseOption("patch")}
                      data-testid="option-patch"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Patch Paint</div>
                          <div className="text-sm text-muted-foreground">
                            Update logos/numbers - Ready in {PAINT_COSTS.PATCH_DOWNTIME_MINUTES} minutes
                          </div>
                        </div>
                        <div className="font-mono font-bold text-chart-2">
                          +${PAINT_COSTS.PATCH_COST.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div 
                      className={`p-3 border rounded-lg cursor-pointer ${purchaseOption === "repaint" ? "border-primary bg-primary/5" : "border-border"}`}
                      onClick={() => setPurchaseOption("repaint")}
                      data-testid="option-repaint"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-semibold">Full Repaint</div>
                          <div className="text-sm text-muted-foreground">
                            Apply your paint scheme - Ready in {PAINT_COSTS.DOWNTIME_MINUTES} minutes
                          </div>
                        </div>
                        <div className="font-mono font-bold text-chart-1">
                          +${PAINT_COSTS.SINGLE_LOCO.toLocaleString()}
                        </div>
                      </div>
                      
                      {purchaseOption === "repaint" && (
                        <div className="mt-3 space-y-2">
                          <Label>Select Paint Scheme</Label>
                          <Select value={selectedPaintScheme || ""} onValueChange={setSelectedPaintScheme}>
                            <SelectTrigger data-testid="select-paint-scheme">
                              <SelectValue placeholder="Choose a paint scheme..." />
                            </SelectTrigger>
                            <SelectContent>
                              {company?.defaultPaintScheme && (
                                <SelectItem value={company.defaultPaintScheme}>
                                  Company Default
                                </SelectItem>
                              )}
                              {paintSchemes.map((scheme) => (
                                <SelectItem key={scheme.id} value={scheme.id}>
                                  {scheme.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {paintSchemes.length === 0 && !company?.defaultPaintScheme && (
                            <p className="text-xs text-muted-foreground">
                              Create paint schemes in the Inventory page
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Total Cost */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Cost</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Locomotive: ${selectedUsedLoco.usedPrice.toLocaleString()}
                      {purchaseOption === "repaint" && ` + Repaint: $${PAINT_COSTS.SINGLE_LOCO.toLocaleString()}`}
                      {purchaseOption === "patch" && ` + Patch: $${PAINT_COSTS.PATCH_COST.toLocaleString()}`}
                    </div>
                  </div>
                  <div className="text-3xl font-bold font-mono">
                    ${(
                      selectedUsedLoco.usedPrice + 
                      (purchaseOption === "repaint" ? PAINT_COSTS.SINGLE_LOCO : 0) +
                      (purchaseOption === "patch" ? PAINT_COSTS.PATCH_COST : 0)
                    ).toLocaleString()}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSelectedUsedLoco(null)}
                  disabled={loading}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleUsedPurchase(selectedUsedLoco)}
                  disabled={loading || !canAfford(selectedUsedLoco.usedPrice + (purchaseOption === "repaint" ? PAINT_COSTS.SINGLE_LOCO : 0) + (purchaseOption === "patch" ? PAINT_COSTS.PATCH_COST : 0))}
                  data-testid="button-purchase"
                >
                  {loading ? "Processing..." : "Purchase"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
