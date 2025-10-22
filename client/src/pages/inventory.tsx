import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Train, Gauge, Fuel, Zap, Weight, TrendingUp, Settings2, DollarSign, Search, Filter, Tag, Activity, Paintbrush } from "lucide-react";
import type { Locomotive } from "@shared/schema";
import { getLocomotiveConditionStatus } from "@shared/schema";
import { doc } from "firebase/firestore";
import { getDbOrThrow, safeUpdateDoc } from "@/lib/firebase";

export default function Inventory() {
  const { playerData, user, refreshPlayerData } = useAuth();
  const { toast } = useToast();
  const [selectedLoco, setSelectedLoco] = useState<Locomotive | null>(null);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [newUnitNumber, setNewUnitNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<"all" | "Local / Yard" | "Long Haul">("all");
  const [showPaintSchemes, setShowPaintSchemes] = useState(false);
  const [paintSchemeMode, setPaintSchemeMode] = useState<"create" | "apply" | "patch" | null>(null);
  const [newPaintScheme, setNewPaintScheme] = useState({
    name: "",
    primaryColor: "#FF0000",
    secondaryColor: "#FFFFFF",
    accentColor: "#000000",
    stripePattern: "solid" as "solid" | "striped" | "checkered" | "custom",
  });
  const [applyPaintTarget, setApplyPaintTarget] = useState<"single" | "all" | "new">("single");
  const [selectedPaintScheme, setSelectedPaintScheme] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  if (!playerData || !user) return null;

  const locomotives = playerData.locomotives;

  // Check for completed paint jobs and update status
  useEffect(() => {
    const checkPaintJobs = async () => {
      const now = Date.now();
      const completedPaintJobs = locomotives.filter(
        l => l.status === "in_paint_shop" && l.paintCompleteAt && l.paintCompleteAt <= now
      );

      if (completedPaintJobs.length > 0) {
        try {
          // Refresh data first to avoid overwriting concurrent changes
          await refreshPlayerData();
          
          const db = getDbOrThrow();
          const playerRef = doc(db, "players", user.uid);
          
          // Get the latest data after refresh
          const freshPlayerData = await refreshPlayerData();
          if (!freshPlayerData?.locomotives) return;
          
          const updatedLocos = freshPlayerData.locomotives.map(l => {
            if (l.status === "in_paint_shop" && l.paintCompleteAt && l.paintCompleteAt <= now) {
              const { paintCompleteAt, ...locoWithoutPaintTime } = l;
              return { ...locoWithoutPaintTime, status: "available" as const };
            }
            return l;
          });

          await safeUpdateDoc(playerRef, { locomotives: updatedLocos });
          await refreshPlayerData();
          
          toast({
            title: "Paint Jobs Complete",
            description: `${completedPaintJobs.length} locomotive(s) ready`,
          });
        } catch (error) {
          console.error("Error completing paint jobs:", error);
        }
      }
    };

    checkPaintJobs();
    
    // Check every 30 seconds for paint job completions
    const interval = setInterval(checkPaintJobs, 30000);
    return () => clearInterval(interval);
  }, [locomotives, user.uid, refreshPlayerData, toast]);

  const filteredLocos = useMemo(() => {
    return locomotives.filter((loco) => {
      const matchesSearch = 
        loco.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loco.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loco.unitNumber.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = filterStatus === "all" || loco.status === filterStatus;
      
      const matchesTag = filterTag === "all" || (loco.tags && loco.tags.includes(filterTag));
      
      return matchesSearch && matchesStatus && matchesTag;
    });
  }, [locomotives, searchQuery, filterStatus, filterTag]);

  const paginatedLocos = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredLocos.slice(startIndex, endIndex);
  }, [filteredLocos, currentPage]);

  const totalPages = Math.ceil(filteredLocos.length / ITEMS_PER_PAGE);

  const handleSell = async (loco: Locomotive) => {
    if (!confirm(`Sell ${loco.model} ${loco.unitNumber} for $${loco.resaleValue.toLocaleString()}?`)) return;

    setLoading(true);
    try {
      const db = getDbOrThrow();
      const playerRef = doc(db, "players", user.uid);
      const updatedLocos = locomotives.filter((l) => l.id !== loco.id);
      const newCash = playerData.stats.cash + loco.resaleValue;

      await safeUpdateDoc(playerRef, {
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
      const db = getDbOrThrow();
      const playerRef = doc(db, "players", user.uid);
      const updatedLocos = locomotives.filter((l) => l.id !== loco.id);
      const newCash = playerData.stats.cash + loco.scrapValue;

      await safeUpdateDoc(playerRef, {
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
      const db = getDbOrThrow();
      const playerRef = doc(db, "players", user.uid);
      const updatedLocos = locomotives.map((l) =>
        l.id === selectedLoco.id ? { ...l, unitNumber: newUnitNumber } : l
      );

      await safeUpdateDoc(playerRef, {
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

  const handleCreatePaintScheme = async () => {
    if (!newPaintScheme.name.trim()) {
      toast({ title: "Invalid Name", description: "Please enter a paint scheme name", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const db = getDbOrThrow();
      const playerRef = doc(db, "players", user.uid);
      const newScheme = {
        id: crypto.randomUUID(),
        ...newPaintScheme,
        createdAt: Date.now(),
      };

      await safeUpdateDoc(playerRef, {
        paintSchemes: [...(playerData.paintSchemes || []), newScheme],
      });

      await refreshPlayerData();
      setPaintSchemeMode(null);
      setNewPaintScheme({ name: "", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", accentColor: "#000000", stripePattern: "solid" });
      toast({ title: "Paint Scheme Created", description: `Created "${newScheme.name}"` });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to create paint scheme", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPaintScheme = async () => {
    if (!selectedPaintScheme) return;

    const scheme = playerData.paintSchemes?.find(s => s.id === selectedPaintScheme);
    if (!scheme) return;

    let cost = 0;
    let updatedLocos = [...locomotives];
    const now = Date.now();
    const PAINT_DOWNTIME = 10 * 60 * 1000; // 10 minutes
    const paintCompleteAt = now + PAINT_DOWNTIME;

    if (applyPaintTarget === "single" && selectedLoco) {
      if (playerData.stats.cash < 5000) {
        toast({ title: "Insufficient Funds", description: "Painting one locomotive costs $5,000", variant: "destructive" });
        return;
      }
      cost = 5000;
      updatedLocos = locomotives.map(l => 
        l.id === selectedLoco.id 
          ? { ...l, paintSchemeId: selectedPaintScheme, status: "in_paint_shop" as const, paintCompleteAt } 
          : l
      );
    } else if (applyPaintTarget === "all") {
      const availableLocos = locomotives.filter(l => l.status === "available");
      cost = availableLocos.length * 3500;
      if (playerData.stats.cash < cost) {
        toast({ title: "Insufficient Funds", description: `Painting all locomotives costs $${cost.toLocaleString()}`, variant: "destructive" });
        return;
      }
      updatedLocos = locomotives.map(l => 
        l.status === "available" 
          ? { ...l, paintSchemeId: selectedPaintScheme, status: "in_paint_shop" as const, paintCompleteAt } 
          : l
      );
    }

    setLoading(true);
    try {
      const db = getDbOrThrow();
      const playerRef = doc(db, "players", user.uid);
      
      const updates: any = {
        locomotives: updatedLocos,
        "stats.cash": playerData.stats.cash - cost,
      };

      // If applying to new locomotives, set a default paint scheme
      if (applyPaintTarget === "new") {
        updates["company.defaultPaintScheme"] = selectedPaintScheme;
      }

      await safeUpdateDoc(playerRef, updates);
      await refreshPlayerData();
      setPaintSchemeMode(null);
      setSelectedLoco(null);
      
      const message = applyPaintTarget === "new" 
        ? "All future locomotives will use this paint scheme" 
        : applyPaintTarget === "all"
        ? `Painting ${locomotives.filter(l => l.status === "available").length} locomotives - they'll be ready in 10 minutes`
        : "Painting in progress - ready in 10 minutes";
      
      toast({ title: "Paint Scheme Applied", description: message });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to apply paint scheme", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePatchPaint = async () => {
    if (!selectedLoco || !selectedLoco.previousOwnerName) return;

    const PATCH_COST = 800;
    const PATCH_DOWNTIME = 2 * 60 * 1000;

    if (playerData.stats.cash < PATCH_COST) {
      toast({ title: "Insufficient Funds", description: `Patching paint costs $${PATCH_COST.toLocaleString()}`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const db = getDbOrThrow();
      const playerRef = doc(db, "players", user.uid);
      const now = Date.now();
      const patchCompleteAt = now + PATCH_DOWNTIME;

      const updatedLocos = locomotives.map(l => 
        l.id === selectedLoco.id 
          ? { ...l, isPatched: true, status: "in_paint_shop" as const, paintCompleteAt: patchCompleteAt } 
          : l
      );

      await safeUpdateDoc(playerRef, {
        locomotives: updatedLocos,
        "stats.cash": playerData.stats.cash - PATCH_COST,
      });

      await refreshPlayerData();
      setSelectedLoco(null);
      setPaintSchemeMode(null);
      
      toast({ 
        title: "Paint Patched!", 
        description: "Logos and numbers updated - ready in 2 minutes",
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to patch paint", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getConditionBadgeVariant = (status: string) => {
    if (status === "excellent" || status === "good") return "default";
    if (status === "fair") return "secondary";
    return "destructive";
  };

  const getPaintSchemeName = (paintSchemeId?: string) => {
    if (!paintSchemeId) return "Factory Default";
    const scheme = playerData.paintSchemes?.find(s => s.id === paintSchemeId);
    return scheme?.name || "Unknown";
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-accent font-bold" data-testid="text-inventory-title">Locomotive Inventory</h1>
          <p className="text-muted-foreground">
            Manage your fleet of {locomotives.length} locomotive{locomotives.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowPaintSchemes(true)} data-testid="button-paint-schemes">
          <Paintbrush className="w-4 h-4 mr-2" />
          Paint Schemes ({playerData.paintSchemes?.length || 0})
        </Button>
      </div>

      {/* Search and Filter */}
      {locomotives.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by model, manufacturer, or unit number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-inventory"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-[180px]" data-testid="select-filter-status">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="needs_repair">Needs Repair</SelectItem>
              <SelectItem value="in_paint_shop">In Paint Shop</SelectItem>
              <SelectItem value="stored">Stored</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTag} onValueChange={(v: any) => setFilterTag(v)}>
            <SelectTrigger className="w-full md:w-[180px]" data-testid="select-filter-tag">
              <Tag className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Local / Yard">Local / Yard</SelectItem>
              <SelectItem value="Long Haul">Long Haul</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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
      ) : filteredLocos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No locomotives match your search criteria
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedLocos.map((loco) => {
            const condition = getLocomotiveConditionStatus(loco.mileage, loco.health || 100);
            return (
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
                  {loco.tags && loco.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {loco.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
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
                      <Activity className="w-3 h-3 text-muted-foreground" />
                      <span>{loco.mileage.toLocaleString()} mi</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-muted-foreground" />
                      <span>{loco.health || 100}% health</span>
                    </div>
                  </div>
                  
                  {/* Health/Condition Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Condition</span>
                      <Badge variant={getConditionBadgeVariant(condition.status)} className="text-xs">
                        {condition.label}
                      </Badge>
                    </div>
                    <Progress value={loco.health || 100} className="h-2" />
                  </div>

                  {/* Paint Scheme */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Paintbrush className="w-3 h-3" />
                    <span>{getPaintSchemeName(loco.paintSchemeId)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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

                {selectedLoco.tags && selectedLoco.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {selectedLoco.tags.map((tag, i) => (
                      <Badge key={i} variant="outline">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Mileage and Health */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Total Mileage</Label>
                    <div className="font-semibold text-lg">{selectedLoco.mileage.toLocaleString()} miles</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Health</Label>
                    <div className="font-semibold text-lg">{selectedLoco.health || 100}%</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Condition Status</Label>
                  <div className="flex items-center justify-between">
                    <Badge variant={getConditionBadgeVariant(getLocomotiveConditionStatus(selectedLoco.mileage, selectedLoco.health || 100).status)}>
                      {getLocomotiveConditionStatus(selectedLoco.mileage, selectedLoco.health || 100).label}
                    </Badge>
                    <Progress value={selectedLoco.health || 100} className="flex-1 ml-4 h-3" />
                  </div>
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

                <div>
                  <Label className="text-muted-foreground">Paint Scheme</Label>
                  <div className="font-semibold flex items-center gap-2">
                    <Paintbrush className="w-4 h-4" />
                    {getPaintSchemeName(selectedLoco.paintSchemeId)}
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

                <div className="flex gap-2 flex-wrap">
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
                    onClick={() => {
                      setPaintSchemeMode("apply");
                      setApplyPaintTarget("single");
                    }}
                    variant="outline"
                    disabled={loading || selectedLoco.status !== "available"}
                    className="flex-1"
                    data-testid="button-paint"
                  >
                    <Paintbrush className="w-4 h-4 mr-2" />
                    Paint
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

      {/* Paint Schemes Management Dialog */}
      <Dialog open={showPaintSchemes} onOpenChange={(open) => !open && setShowPaintSchemes(false)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Paint Schemes</DialogTitle>
            <DialogDescription>
              Create and manage custom paint schemes for your locomotives
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button onClick={() => setPaintSchemeMode("create")} className="w-full" data-testid="button-create-scheme">
              <Paintbrush className="w-4 h-4 mr-2" />
              Create New Paint Scheme
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {(playerData.paintSchemes || []).map((scheme) => (
                <Card key={scheme.id} className="hover-elevate cursor-pointer" onClick={() => {
                  setSelectedPaintScheme(scheme.id);
                  setPaintSchemeMode("apply");
                  setApplyPaintTarget("all");
                }} data-testid={`card-scheme-${scheme.id}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{scheme.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <div className="w-12 h-12 rounded border" style={{ backgroundColor: scheme.primaryColor }} title="Primary" />
                      <div className="w-12 h-12 rounded border" style={{ backgroundColor: scheme.secondaryColor }} title="Secondary" />
                      {scheme.accentColor && (
                        <div className="w-12 h-12 rounded border" style={{ backgroundColor: scheme.accentColor }} title="Accent" />
                      )}
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground capitalize">{scheme.stripePattern}</div>
                  </CardContent>
                </Card>
              ))}
              {(playerData.paintSchemes || []).length === 0 && (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  No paint schemes yet. Create one to get started!
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Paint Scheme Dialog */}
      <Dialog open={paintSchemeMode === "create"} onOpenChange={(open) => !open && setPaintSchemeMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Paint Scheme</DialogTitle>
            <DialogDescription>
              Design a custom paint scheme for your locomotives
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scheme-name">Scheme Name</Label>
              <Input
                id="scheme-name"
                value={newPaintScheme.name}
                onChange={(e) => setNewPaintScheme({ ...newPaintScheme, name: e.target.value })}
                placeholder="e.g. Classic Red & White"
                data-testid="input-scheme-name"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Primary Color</Label>
                <Input
                  id="primary-color"
                  type="color"
                  value={newPaintScheme.primaryColor}
                  onChange={(e) => setNewPaintScheme({ ...newPaintScheme, primaryColor: e.target.value })}
                  data-testid="input-primary-color"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary-color">Secondary Color</Label>
                <Input
                  id="secondary-color"
                  type="color"
                  value={newPaintScheme.secondaryColor}
                  onChange={(e) => setNewPaintScheme({ ...newPaintScheme, secondaryColor: e.target.value })}
                  data-testid="input-secondary-color"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent-color">Accent Color</Label>
                <Input
                  id="accent-color"
                  type="color"
                  value={newPaintScheme.accentColor}
                  onChange={(e) => setNewPaintScheme({ ...newPaintScheme, accentColor: e.target.value })}
                  data-testid="input-accent-color"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Stripe Pattern</Label>
              <Select value={newPaintScheme.stripePattern} onValueChange={(v: any) => setNewPaintScheme({ ...newPaintScheme, stripePattern: v })}>
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

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPaintSchemeMode(null)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreatePaintScheme} disabled={loading || !newPaintScheme.name.trim()} className="flex-1" data-testid="button-confirm-create">
                Create Scheme
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply Paint Scheme Dialog */}
      <Dialog open={paintSchemeMode === "apply"} onOpenChange={(open) => !open && setPaintSchemeMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Paint Scheme</DialogTitle>
            <DialogDescription>
              Choose a paint scheme and select where to apply it
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Paint Scheme</Label>
              <Select value={selectedPaintScheme || ""} onValueChange={setSelectedPaintScheme}>
                <SelectTrigger data-testid="select-paint-scheme">
                  <SelectValue placeholder="Choose a paint scheme" />
                </SelectTrigger>
                <SelectContent>
                  {(playerData.paintSchemes || []).map((scheme) => (
                    <SelectItem key={scheme.id} value={scheme.id}>{scheme.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Apply To</Label>
              <Select value={applyPaintTarget} onValueChange={(v: any) => setApplyPaintTarget(v)}>
                <SelectTrigger data-testid="select-paint-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedLoco && <SelectItem value="single">This Locomotive Only ($5,000)</SelectItem>}
                  <SelectItem value="all">All Available Locomotives (${(locomotives.filter(l => l.status === "available").length * 3500).toLocaleString()})</SelectItem>
                  <SelectItem value="new">Future Locomotives (Free - sets default)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Locomotives will be out of service for 10 minutes during painting
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPaintSchemeMode(null)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleApplyPaintScheme} disabled={loading || !selectedPaintScheme} className="flex-1" data-testid="button-confirm-apply">
                Apply Paint
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
