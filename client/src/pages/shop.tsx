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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LOCOMOTIVE_CATALOG, type LocomotiveCatalogItem, generateUsedLocomotive, type UsedLocomotiveItem, type DealershipStock, generateDealershipStock } from "@shared/schema";
import { Zap, TrendingUp, Gauge, Weight, DollarSign, Search, Filter, Fuel, Tag, Activity } from "lucide-react";
import { doc } from "firebase/firestore";
import { getDbOrThrow, safeUpdateDoc } from "@/lib/firebase";
import { generateUUID } from "@/lib/uuid";

export default function Shop() {
  const { playerData, user, refreshPlayerData } = useAuth();
  const { toast } = useToast();
  const [selectedLoco, setSelectedLoco] = useState<LocomotiveCatalogItem | null>(null);
  const [selectedUsedLoco, setSelectedUsedLoco] = useState<UsedLocomotiveItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState<"all" | "Local / Yard" | "Long Haul">("all");
  const [sortBy, setSortBy] = useState<"price" | "hp" | "name">("price");
  const [bulkQuantity, setBulkQuantity] = useState(1);
  const [marketTab, setMarketTab] = useState<"new" | "used">("new");

  if (!playerData || !user) return null;

  const stats = playerData.stats || {
    cash: 0,
    xp: 0,
    level: 1,
    nextLocoId: 1,
    points: 0,
    totalJobsCompleted: 0,
  };
  const company = playerData.company;
  const dealershipStock = playerData.dealershipStock || [];

  const getStock = (model: string): number => {
    const stockItem = dealershipStock.find(s => s.model === model);
    return stockItem ? stockItem.stock : 0;
  };

  const filteredAndSortedLocos = useMemo(() => {
    let filtered = LOCOMOTIVE_CATALOG.filter((loco) => {
      const matchesSearch = 
        loco.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loco.manufacturer.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTag = filterTag === "all" || loco.tags.includes(filterTag);
      
      return matchesSearch && matchesTag;
    });

    filtered.sort((a, b) => {
      if (sortBy === "price") return a.purchaseCost - b.purchaseCost;
      if (sortBy === "hp") return b.horsepower - a.horsepower;
      return a.model.localeCompare(b.model);
    });

    return filtered;
  }, [searchQuery, filterTag, sortBy]);

  const usedLocomotives = useMemo(() => {
    let used = LOCOMOTIVE_CATALOG.map(loco => generateUsedLocomotive(loco)).filter((loco) => {
      const matchesSearch = 
        loco.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loco.manufacturer.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTag = filterTag === "all" || loco.tags.includes(filterTag);
      
      return matchesSearch && matchesTag;
    });

    used.sort((a, b) => {
      if (sortBy === "price") return a.usedPrice - b.usedPrice;
      if (sortBy === "hp") return b.horsepower - a.horsepower;
      return a.model.localeCompare(b.model);
    });

    return used;
  }, [searchQuery, filterTag, sortBy]);

  const handlePurchase = async (catalogItem: LocomotiveCatalogItem, quantity: number) => {
    const totalCost = catalogItem.purchaseCost * quantity;
    const currentStock = getStock(catalogItem.model);
    
    if (currentStock < quantity) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${currentStock} ${catalogItem.model}${currentStock !== 1 ? 's' : ''} available in stock.`,
        variant: "destructive",
      });
      return;
    }
    
    if (stats.cash < totalCost) {
      toast({
        title: "Insufficient Funds",
        description: `You need $${totalCost.toLocaleString()} to purchase ${quantity} locomotive${quantity > 1 ? 's' : ''}.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const db = getDbOrThrow();
      const playerRef = doc(db, "players", user.uid);
      let nextId = stats.nextLocoId;
      const newLocos = [];
      const defaultPaintScheme = company?.defaultPaintScheme;

      for (let i = 0; i < quantity; i++) {
        const unitNumber = `#${nextId.toString().padStart(4, "0")}`;
        
        const newLoco: any = {
          id: generateUUID(),
          unitNumber,
          model: catalogItem.model,
          manufacturer: catalogItem.manufacturer,
          tier: catalogItem.tier,
          tags: catalogItem.tags,
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
          health: 100,
          paintCondition: 100,
          status: "available" as const,
          purchasedAt: Date.now(),
          notes: catalogItem.notes,
        };

        if (defaultPaintScheme) {
          newLoco.paintSchemeId = defaultPaintScheme;
        }

        newLocos.push(newLoco);
        nextId++;
      }

      // Update dealership stock by decrementing the quantity purchased
      const updatedStock = dealershipStock.map(item => 
        item.model === catalogItem.model 
          ? { ...item, stock: Math.max(0, item.stock - quantity) }
          : item
      );

      await safeUpdateDoc(playerRef, {
        locomotives: [...playerData.locomotives, ...newLocos],
        "stats.cash": stats.cash - totalCost,
        "stats.nextLocoId": nextId,
        dealershipStock: updatedStock,
      });

      await refreshPlayerData();
      setSelectedLoco(null);
      setBulkQuantity(1);
      toast({
        title: "Locomotive Purchased!",
        description: `${quantity} x ${catalogItem.model} added to your fleet for $${totalCost.toLocaleString()}`,
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

  const handleUsedPurchase = async (usedItem: UsedLocomotiveItem) => {
    if (stats.cash < usedItem.usedPrice) {
      toast({
        title: "Insufficient Funds",
        description: `You need $${usedItem.usedPrice.toLocaleString()} to purchase this used locomotive.`,
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

      const newLoco: any = {
        id: generateUUID(),
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
        paintCondition: 60,
        previousOwnerName: usedItem.previousOwner,
        isUsed: true,
        status: usedItem.needsRepair ? "needs_repair" as const : "available" as const,
        purchasedAt: Date.now(),
        notes: usedItem.notes,
      };

      await safeUpdateDoc(playerRef, {
        locomotives: [...playerData.locomotives, newLoco],
        "stats.cash": stats.cash - usedItem.usedPrice,
        "stats.nextLocoId": nextId + 1,
      });

      await refreshPlayerData();
      setSelectedUsedLoco(null);
      toast({
        title: "Used Locomotive Purchased!",
        description: `${usedItem.model} (ex-${usedItem.previousOwner}) added to your fleet for $${usedItem.usedPrice.toLocaleString()}`,
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

  const canAfford = (price: number, quantity: number = 1) => stats.cash >= (price * quantity);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-accent font-bold" data-testid="text-shop-title">Locomotive Shop</h1>
        <p className="text-muted-foreground">
          Purchase locomotives to expand your fleet - all models available!
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by model or manufacturer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-locomotives"
          />
        </div>
        <Select value={filterTag} onValueChange={(v: any) => setFilterTag(v)}>
          <SelectTrigger className="w-full md:w-[200px]" data-testid="select-filter-tag">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locomotives</SelectItem>
            <SelectItem value="Local / Yard">Local / Yard</SelectItem>
            <SelectItem value="Long Haul">Long Haul</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-full md:w-[200px]" data-testid="select-sort-by">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price">Price (Low to High)</SelectItem>
            <SelectItem value="hp">Horsepower (High to Low)</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Locomotive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedLocos.map((loco, idx) => (
          <Card
            key={idx}
            className="hover-elevate cursor-pointer"
            onClick={() => setSelectedLoco(loco)}
            data-testid={`card-shop-loco-${idx}`}
          >
            <CardHeader>
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
                  <Fuel className="w-3 h-3 text-muted-foreground" />
                  <span>{loco.fuelCapacity} gal</span>
                </div>
                <div className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-muted-foreground" />
                  <span>{loco.reliability}%</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">
                    ${loco.purchaseCost.toLocaleString()}
                  </span>
                  <Badge variant={canAfford(loco.purchaseCost) ? "default" : "secondary"}>
                    {canAfford(loco.purchaseCost) ? "Can Afford" : "Too Expensive"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Stock:</span>
                  <Badge variant={getStock(loco.model) > 0 ? "outline" : "destructive"}>
                    {getStock(loco.model)} available
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAndSortedLocos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No locomotives match your search criteria
        </div>
      )}

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
                <div className="flex gap-1 flex-wrap mt-2">
                  {selectedLoco.tags.map((tag, i) => (
                    <Badge key={i} variant="outline">
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
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

                <Separator />

                {/* Bulk Purchase */}
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity (1-999)</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max="999"
                    value={bulkQuantity}
                    onChange={(e) => setBulkQuantity(Math.min(999, Math.max(1, parseInt(e.target.value) || 1)))}
                    data-testid="input-bulk-quantity"
                  />
                  <p className="text-xs text-muted-foreground">
                    Purchase multiple units at once
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Cost</div>
                    <div className="text-2xl font-bold">
                      ${(selectedLoco.purchaseCost * bulkQuantity).toLocaleString()}
                    </div>
                    {bulkQuantity > 1 && (
                      <div className="text-xs text-muted-foreground">
                        ${selectedLoco.purchaseCost.toLocaleString()} × {bulkQuantity}
                      </div>
                    )}
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
                <Button variant="outline" onClick={() => setSelectedLoco(null)} data-testid="button-cancel-purchase">
                  Cancel
                </Button>
                <Button
                  onClick={() => handlePurchase(selectedLoco, bulkQuantity)}
                  disabled={loading || !canAfford(selectedLoco.purchaseCost, bulkQuantity)}
                  data-testid="button-confirm-purchase"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Purchase {bulkQuantity > 1 ? `(${bulkQuantity})` : ''}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
