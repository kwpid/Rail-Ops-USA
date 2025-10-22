import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Package, Zap, DollarSign, Clock, Star, Lock, ArrowRight, TrendingUp, TrendingDown, Minus, PackageOpen, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Job, CarManifest } from "@shared/schema";
import { FREIGHT_TYPES } from "@shared/schema";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { calculateLevel, getXpForNextLevel } from "@shared/schema";
import { LevelUpNotification } from "@/components/level-up-notification";

const CAR_TYPES = [
  { type: "Boxcar", contents: ["General Freight", "Packaged Goods", "Appliances", "Paper Products"] },
  { type: "Covered Hopper", contents: ["Grain", "Wheat", "Corn", "Soybeans", "Flour", "Cement"] },
  { type: "Open Hopper", contents: ["Coal", "Aggregate", "Scrap Metal", "Sand"] },
  { type: "Tank Car", contents: ["Crude Oil", "Chemicals", "Liquid Fertilizer", "Corn Syrup"] },
  { type: "Gondola", contents: ["Steel Coils", "Steel Plates", "Scrap Metal", "Lumber"] },
  { type: "Flatcar", contents: ["Steel Beams", "Construction Equipment", "Lumber", "Pipes"] },
  { type: "Intermodal", contents: ["Containers (Mixed)", "Containers (Consumer Goods)", "Trailers"] },
  { type: "Autorack", contents: ["New Automobiles", "New Trucks", "New SUVs"] },
];

const YARD_SWITCHING_TASKS = [
  "Assemble outbound manifest freight",
  "Break down incoming unit train",
  "Sort mixed freight by destination",
  "Spot cars at industrial sidings",
  "Build unit coal train",
  "Interchange with Class I railroad",
  "Organize intermodal terminal",
  "Service local industries",
];

const generateManifest = (freightType: string, totalCars: number): CarManifest[] => {
  const manifest: CarManifest[] = [];
  
  if (freightType === "Coal") {
    manifest.push({
      carType: "Open Hopper",
      content: "Coal",
      count: totalCars,
      weight: 110,
    });
  } else if (freightType === "Intermodal") {
    const containers = Math.floor(totalCars * 0.7);
    const trailers = totalCars - containers;
    manifest.push({
      carType: "Intermodal",
      content: "Containers (Mixed)",
      count: containers,
      weight: 75,
    });
    if (trailers > 0) {
      manifest.push({
        carType: "Intermodal",
        content: "Trailers",
        count: trailers,
        weight: 60,
      });
    }
  } else if (freightType === "Grain") {
    manifest.push({
      carType: "Covered Hopper",
      content: ["Corn", "Wheat", "Soybeans"][Math.floor(Math.random() * 3)],
      count: totalCars,
      weight: 100,
    });
  } else if (freightType === "Chemicals") {
    manifest.push({
      carType: "Tank Car",
      content: "Hazardous Chemicals",
      count: totalCars,
      weight: 90,
    });
  } else if (freightType === "Automotive") {
    manifest.push({
      carType: "Autorack",
      content: "New Automobiles",
      count: totalCars,
      weight: 70,
    });
  } else if (freightType === "Steel") {
    manifest.push({
      carType: "Gondola",
      content: "Steel Coils",
      count: totalCars,
      weight: 120,
    });
  } else {
    const carTypes = CAR_TYPES.filter(c => !["Intermodal", "Autorack"].includes(c.type));
    const numTypes = Math.min(3, Math.max(1, Math.floor(totalCars / 3)));
    let remainingCars = totalCars;
    
    for (let i = 0; i < numTypes && remainingCars > 0; i++) {
      const carType = carTypes[Math.floor(Math.random() * carTypes.length)];
      const count = i === numTypes - 1 ? remainingCars : Math.ceil(remainingCars / (numTypes - i));
      const content = carType.contents[Math.floor(Math.random() * carType.contents.length)];
      
      manifest.push({
        carType: carType.type,
        content,
        count,
        weight: 80 + Math.random() * 40,
      });
      
      remainingCars -= count;
    }
  }
  
  return manifest;
};

const generateJobs = (tier: 1 | 2 | 3, playerCity: string, playerLevel: number): Job[] => {
  const cities = ["Atlanta, GA", "Charlotte, NC", "Memphis, TN", "Nashville, TN", "Birmingham, AL", "Chattanooga, TN"];
  const otherCities = cities.filter(c => c !== playerCity);
  
  // Local destinations within the same city
  const localDestinations = [
    "Industrial Park",
    "East Yard",
    "West Terminal",
    "Port Facility",
    "North Industrial",
    "South Distribution Center",
    "Manufacturing District",
    "Intermodal Terminal",
    "Grain Elevator",
    "Steel Mill",
    "Chemical Plant",
    "Auto Assembly Plant",
  ];
  
  const jobs: Job[] = [];
  
  if (tier === 1) {
    const numLocalFreight = 4;
    const numYardSwitching = 2;
    
    for (let i = 0; i < numLocalFreight; i++) {
      const destination = localDestinations[Math.floor(Math.random() * localDestinations.length)];
      const freightType = FREIGHT_TYPES[Math.floor(Math.random() * FREIGHT_TYPES.length)];
      const distance = 5 + Math.random() * 11; // Short local distances (5-15 miles after floor)
      const carCount = 4 + Math.floor(Math.random() * 8);
      const manifest = generateManifest(freightType.type, carCount);
      const hpRequired = carCount * 150;
      const timeMinutes = 8 + Math.random() * 7;
      const basePayout = distance * carCount * 25; // Higher rate per mile for local
      
      jobs.push({
        id: crypto.randomUUID(),
        jobId: `LCL-${String(i + 1).padStart(3, "0")}`,
        tier: 1,
        jobType: "local_freight",
        origin: `${playerCity} Yard`,
        destination: `${playerCity} ${destination}`,
        distance: Math.floor(distance),
        freightType: freightType.type,
        demandLevel: "medium",
        carCount,
        manifest,
        hpRequired,
        payout: Math.floor(basePayout),
        timeMinutes: Math.floor(timeMinutes),
        xpReward: Math.floor(distance * 5),
        status: "available",
        generatedAt: Date.now(),
      });
    }
    
    for (let i = 0; i < numYardSwitching; i++) {
      const task = YARD_SWITCHING_TASKS[Math.floor(Math.random() * YARD_SWITCHING_TASKS.length)];
      const carCount = 8 + Math.floor(Math.random() * 12);
      const manifest = generateManifest("Mixed Manifest", carCount);
      const hpRequired = 1500;
      const timeMinutes = 6 + Math.random() * 4;
      const basePayout = carCount * 220;
      
      jobs.push({
        id: crypto.randomUUID(),
        jobId: `YRD-${String(i + 1).padStart(3, "0")}`,
        tier: 1,
        jobType: "yard_switching",
        origin: `${playerCity} Yard`,
        destination: `${playerCity} Yard`,
        distance: 0,
        freightType: task,
        demandLevel: "medium",
        carCount,
        manifest,
        hpRequired,
        payout: Math.floor(basePayout),
        timeMinutes: Math.floor(timeMinutes),
        xpReward: 30 + Math.floor(carCount * 2),
        status: "available",
        generatedAt: Date.now(),
      });
    }
  } else if (tier === 2) {
    const jobCount = 4;
    for (let i = 0; i < jobCount; i++) {
      const destination = otherCities[Math.floor(Math.random() * otherCities.length)];
      const freightType = FREIGHT_TYPES[Math.floor(Math.random() * FREIGHT_TYPES.length)];
      const distance = 80 + Math.random() * 120;
      const carCount = 15 + Math.floor(Math.random() * 25);
      const manifest = generateManifest(freightType.type, carCount);
      const hpRequired = carCount * 200;
      const timeMinutes = 45 + Math.random() * 45;
      const basePayout = distance * carCount * 30;
      
      jobs.push({
        id: crypto.randomUUID(),
        jobId: `MLF-${String(i + 1).padStart(3, "0")}`,
        tier: 2,
        jobType: "mainline_freight",
        origin: playerCity,
        destination,
        distance: Math.floor(distance),
        freightType: freightType.type,
        demandLevel: "medium",
        carCount,
        manifest,
        hpRequired,
        payout: Math.floor(basePayout),
        timeMinutes: Math.floor(timeMinutes),
        xpReward: Math.floor(distance * 10),
        status: "available",
        generatedAt: Date.now(),
      });
    }
  } else if (tier === 3) {
    const jobCount = 3;
    for (let i = 0; i < jobCount; i++) {
      const destination = otherCities[Math.floor(Math.random() * otherCities.length)];
      const freightType = ["Coal", "Intermodal", "Automotive"][Math.floor(Math.random() * 3)];
      const distance = 200 + Math.random() * 300;
      const carCount = 40 + Math.floor(Math.random() * 80);
      const manifest = generateManifest(freightType, carCount);
      const hpRequired = carCount * 250;
      const timeMinutes = 120 + Math.random() * 180;
      const basePayout = distance * carCount * 55;
      
      jobs.push({
        id: crypto.randomUUID(),
        jobId: `SPF-${String(i + 1).padStart(3, "0")}`,
        tier: 3,
        jobType: "special_freight",
        origin: playerCity,
        destination,
        distance: Math.floor(distance),
        freightType,
        demandLevel: "high",
        carCount,
        manifest,
        hpRequired,
        payout: Math.floor(basePayout),
        timeMinutes: Math.floor(timeMinutes),
        xpReward: Math.floor(distance * 20),
        status: "available",
        generatedAt: Date.now(),
      });
    }
  }
  
  return jobs;
};

export default function Jobs() {
  const { playerData, user, refreshPlayerData } = useAuth();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedLocos, setSelectedLocos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState<{ level: number; unlocks: string[] } | null>(null);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  if (!playerData || !user) return null;

  const stats = playerData.stats;
  const locomotives = playerData.locomotives;
  const company = playerData.company!;

  useEffect(() => {
    const initializeJobs = async () => {
      if (playerData.jobs.length === 0) {
        const tier1 = generateJobs(1, company.city, stats.level);
        const tier2 = stats.level >= 10 ? generateJobs(2, company.city, stats.level) : [];
        const tier3 = stats.level >= 50 ? generateJobs(3, company.city, stats.level) : [];
        
        try {
          const playerRef = doc(db, "players", user.uid);
          await updateDoc(playerRef, {
            jobs: [...tier1, ...tier2, ...tier3],
          });
        } catch (error) {
          console.error("Error initializing jobs:", error);
        }
      }
    };

    initializeJobs();
  }, [playerData.jobs.length, company.city, stats.level, user.uid]);

  // Auto-refresh jobs every 30 minutes (at XX:00 and XX:30)
  useEffect(() => {
    const checkAndRefreshJobs = async () => {
      const now = new Date();
      const minutes = now.getMinutes();
      
      // Only refresh at exactly XX:00 or XX:30
      if (minutes !== 0 && minutes !== 30) return;
      
      // Check if we need to refresh (jobs older than 30 minutes)
      const oldestAvailableJob = playerData.jobs
        .filter(j => j.status === "available")
        .reduce((oldest, job) => {
          return !oldest || (job.generatedAt || 0) < (oldest.generatedAt || 0) ? job : oldest;
        }, null as Job | null);
      
      if (!oldestAvailableJob) return;
      
      const jobAge = Date.now() - (oldestAvailableJob.generatedAt || 0);
      const thirtyMinutes = 30 * 60 * 1000;
      
      // If oldest job is less than 29 minutes old, don't refresh yet
      if (jobAge < (29 * 60 * 1000)) return;
      
      // Refresh jobs - keep ongoing jobs, generate new available jobs
      const ongoingJobs = playerData.jobs.filter(j => j.status === "in_progress");
      const tier1 = generateJobs(1, company.city, stats.level);
      const tier2 = stats.level >= 10 ? generateJobs(2, company.city, stats.level) : [];
      const tier3 = stats.level >= 50 ? generateJobs(3, company.city, stats.level) : [];
      
      try {
        const playerRef = doc(db, "players", user.uid);
        await updateDoc(playerRef, {
          jobs: [...ongoingJobs, ...tier1, ...tier2, ...tier3],
        });
        
        toast({
          title: "Jobs Refreshed",
          description: "New freight opportunities are now available",
        });
      } catch (error) {
        console.error("Error refreshing jobs:", error);
      }
    };

    // Check every minute
    const interval = setInterval(checkAndRefreshJobs, 60 * 1000);
    
    // Also check immediately on mount
    checkAndRefreshJobs();
    
    return () => clearInterval(interval);
  }, [playerData.jobs, company.city, stats.level, user.uid, toast]);

  // Timer to show when jobs will refresh
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      
      // Calculate time until next refresh (XX:00 or XX:30)
      let minutesUntilRefresh;
      if (minutes < 30) {
        minutesUntilRefresh = 29 - minutes;
      } else {
        minutesUntilRefresh = 59 - minutes;
      }
      const secondsUntilRefresh = 60 - seconds;
      
      setTimeUntilRefresh(`${minutesUntilRefresh}m ${secondsUntilRefresh}s`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Manual refresh function
  const handleManualRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      const ongoingJobs = playerData.jobs.filter(j => j.status === "in_progress");
      const tier1 = generateJobs(1, company.city, stats.level);
      const tier2 = stats.level >= 10 ? generateJobs(2, company.city, stats.level) : [];
      const tier3 = stats.level >= 50 ? generateJobs(3, company.city, stats.level) : [];
      
      const playerRef = doc(db, "players", user.uid);
      await updateDoc(playerRef, {
        jobs: [...ongoingJobs, ...tier1, ...tier2, ...tier3],
      });
      
      await refreshPlayerData();
      
      toast({
        title: "Jobs Refreshed",
        description: "New freight opportunities are now available",
      });
    } catch (error) {
      console.error("Error refreshing jobs:", error);
      toast({
        title: "Error",
        description: "Failed to refresh jobs",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const availableLocos = locomotives.filter((l) => l.status === "available");
  const totalSelectedHP = selectedLocos.reduce((sum, id) => {
    const loco = locomotives.find((l) => l.id === id);
    return sum + (loco?.horsepower || 0);
  }, 0);

  const handleAssignJob = async () => {
    if (!selectedJob || selectedLocos.length === 0) return;

    if (totalSelectedHP < selectedJob.hpRequired) {
      toast({
        title: "Insufficient Horsepower",
        description: `This job requires ${selectedJob.hpRequired} HP. You have selected ${totalSelectedHP} HP.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const playerRef = doc(db, "players", user.uid);
      const now = Date.now();
      const completionTime = now + (selectedJob.timeMinutes || 60) * 60 * 1000;

      const updatedJobs = playerData.jobs.map((j) =>
        j.id === selectedJob.id
          ? { ...j, status: "in_progress" as const, assignedLocos: selectedLocos, startedAt: now, completesAt: completionTime }
          : j
      );

      const updatedLocos = locomotives.map((l) =>
        selectedLocos.includes(l.id) ? { ...l, status: "assigned" as const, assignedJobId: selectedJob.id } : l
      );

      await updateDoc(playerRef, {
        jobs: updatedJobs,
        locomotives: updatedLocos,
      });

      await refreshPlayerData();
      setSelectedJob(null);
      setSelectedLocos([]);
      
      toast({
        title: "Job Assigned!",
        description: `${selectedLocos.length} locomotive(s) assigned to ${selectedJob.jobId}`,
      });

      setTimeout(async () => {
        await completeJob(selectedJob.id);
      }, 2000);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to assign job",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const completeJob = async (jobId: string) => {
    try {
      const playerRef = doc(db, "players", user.uid);
      const job = playerData.jobs.find((j) => j.id === jobId);
      if (!job || job.status !== "in_progress") return;

      const newCash = stats.cash + job.payout;
      const newXp = stats.xp + job.xpReward;
      const oldLevel = stats.level;
      const newLevel = calculateLevel(newXp);

      const updatedJobs = playerData.jobs.map((j) =>
        j.id === jobId ? { ...j, status: "completed" as const } : j
      );

      const updatedLocos = locomotives.map((l) =>
        l.assignedJobId === jobId ? { ...l, status: "available" as const, assignedJobId: undefined } : l
      );

      await updateDoc(playerRef, {
        jobs: updatedJobs,
        locomotives: updatedLocos,
        "stats.cash": newCash,
        "stats.xp": newXp,
        "stats.level": newLevel,
      });

      await refreshPlayerData();

      toast({
        title: "Job Completed!",
        description: `Earned $${job.payout.toLocaleString()} and ${job.xpReward} XP`,
      });

      if (newLevel > oldLevel) {
        const unlocks = [];
        if (newLevel === 10) unlocks.push("Mainline Freight Jobs");
        if (newLevel === 50) unlocks.push("Special Freight Jobs");
        setLevelUpInfo({ level: newLevel, unlocks });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const availableJobs = playerData.jobs.filter((j) => j.status === "available");
  const currentJobs = playerData.jobs.filter((j) => j.status === "in_progress");
  const tier1Jobs = availableJobs.filter((j) => j.tier === 1);
  const tier2Jobs = availableJobs.filter((j) => j.tier === 2);
  const tier3Jobs = availableJobs.filter((j) => j.tier === 3);

  const getDemandIcon = (level: string) => {
    if (level === "high" || level === "critical") return <TrendingUp className="w-3 h-3" />;
    if (level === "low") return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getDemandColor = (level: string) => {
    if (level === "critical") return "text-destructive";
    if (level === "high") return "text-chart-3";
    if (level === "medium") return "text-chart-2";
    return "text-muted-foreground";
  };

  const CurrentJobCard = ({ job }: { job: Job }) => {
    const now = Date.now();
    const progress = job.completesAt && job.startedAt
      ? Math.min(100, ((now - job.startedAt) / (job.completesAt - job.startedAt)) * 100)
      : 0;
    const timeRemaining = job.completesAt ? Math.max(0, job.completesAt - now) : 0;
    const minutesRemaining = Math.ceil(timeRemaining / 60000);

    return (
      <Card className="hover-elevate">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="font-mono text-lg">{job.jobId}</CardTitle>
              <CardDescription>{job.freightType}</CardDescription>
            </div>
            <Badge variant="secondary">In Progress</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{job.origin}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{job.destination}</span>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{minutesRemaining} min remaining</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1">
              <Package className="w-3 h-3 text-muted-foreground" />
              <span>{job.carCount} cars</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>{job.timeMinutes} min</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1 text-chart-3 font-semibold">
              <DollarSign className="w-4 h-4" />
              <span>${job.payout.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 text-chart-4 font-semibold">
              <Star className="w-4 h-4" />
              <span>{job.xpReward} XP</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const JobCard = ({ job }: { job: Job }) => (
    <Card
      className="hover-elevate cursor-pointer"
      onClick={() => setSelectedJob(job)}
      data-testid={`card-job-${job.id}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-mono text-lg">{job.jobId}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              {job.freightType}
              <span className={`flex items-center gap-1 text-xs ${getDemandColor(job.demandLevel)}`}>
                {getDemandIcon(job.demandLevel)}
                {job.demandLevel}
              </span>
            </CardDescription>
          </div>
          <Badge variant={job.jobType === "yard_switching" ? "outline" : "default"}>
            {job.jobType === "yard_switching" ? "Yard" : "Freight"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{job.origin}</span>
          {job.destination !== job.origin && (
            <>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{job.destination}</span>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <Package className="w-3 h-3 text-muted-foreground" />
            <span>{job.carCount} cars</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-muted-foreground" />
            <span>{job.hpRequired} HP</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span>{job.timeMinutes} min</span>
          </div>
          {job.distance > 0 && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <span>{job.distance} mi</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1 text-chart-3 font-semibold">
            <DollarSign className="w-4 h-4" />
            <span>${job.payout.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-chart-4 font-semibold">
            <Star className="w-4 h-4" />
            <span>{job.xpReward} XP</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-accent font-bold">Job Board</h1>
            <p className="text-muted-foreground">
              Available freight jobs from {company.city}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Next Refresh</div>
              <div className="text-lg font-semibold font-mono">{timeUntilRefresh}</div>
            </div>
            <Button 
              onClick={handleManualRefresh} 
              disabled={refreshing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Now
            </Button>
          </div>
        </div>

        <Tabs defaultValue="current">
          <TabsList>
            <TabsTrigger value="current" data-testid="tab-current">
              Current Jobs ({currentJobs.length})
            </TabsTrigger>
            <TabsTrigger value="tier1" data-testid="tab-tier1">
              Local Freight
            </TabsTrigger>
            <TabsTrigger value="tier2" disabled={stats.level < 10} data-testid="tab-tier2">
              Mainline Freight
              {stats.level < 10 && <Lock className="w-3 h-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="tier3" disabled={stats.level < 50} data-testid="tab-tier3">
              Special Freight
              {stats.level < 50 && <Lock className="w-3 h-3 ml-1" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-4">
            {currentJobs.length === 0 ? (
              <Card className="p-12 text-center">
                <PackageOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Active Jobs</h3>
                <p className="text-muted-foreground">
                  Assign locomotives to jobs from the other tabs to get started
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentJobs.map((job) => (
                  <CurrentJobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tier1" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tier1Jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tier2" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tier2Jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tier3" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tier3Jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-accent font-mono">
                  {selectedJob.jobId}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  {selectedJob.freightType}
                  <Badge variant={selectedJob.jobType === "yard_switching" ? "outline" : "default"}>
                    {selectedJob.jobType === "yard_switching" ? "Yard Switching" : "Freight"}
                  </Badge>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-md">
                  <div>
                    <div className="text-sm text-muted-foreground">Route</div>
                    <div className="font-medium flex items-center gap-1">
                      <span>{selectedJob.origin}</span>
                      {selectedJob.destination !== selectedJob.origin && (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          <span>{selectedJob.destination}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Distance</div>
                    <div className="font-semibold">{selectedJob.distance > 0 ? `${selectedJob.distance} miles` : "Yard Work"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Car Count</div>
                    <div className="font-semibold">{selectedJob.carCount} cars</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Time</div>
                    <div className="font-semibold">{selectedJob.timeMinutes} minutes</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Manifest Details</Label>
                  <div className="space-y-2">
                    {(selectedJob.manifest || []).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                        <div>
                          <div className="font-medium">{item.carType}</div>
                          <div className="text-sm text-muted-foreground">{item.content}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{item.count} cars</div>
                          <div className="text-sm text-muted-foreground">{item.weight.toFixed(0)} tons/car</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-primary/10 rounded-md">
                  <div>
                    <div className="text-sm text-muted-foreground">HP Required</div>
                    <div className="text-xl font-bold">{selectedJob.hpRequired} HP</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Selected HP</div>
                    <div className={`text-xl font-bold ${totalSelectedHP >= selectedJob.hpRequired ? "text-chart-3" : "text-destructive"}`}>
                      {totalSelectedHP} HP
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Select Locomotives ({availableLocos.length} available)</Label>
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {availableLocos.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No locomotives available
                      </p>
                    ) : (
                      availableLocos.map((loco) => (
                        <div
                          key={loco.id}
                          className="flex items-center gap-3 p-3 border rounded-md hover-elevate"
                        >
                          <Checkbox
                            checked={selectedLocos.includes(loco.id)}
                            onCheckedChange={(checked) => {
                              setSelectedLocos((prev) =>
                                checked
                                  ? [...prev, loco.id]
                                  : prev.filter((id) => id !== loco.id)
                              );
                            }}
                            data-testid={`checkbox-loco-${loco.id}`}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{loco.model}</div>
                            <div className="text-sm text-muted-foreground">
                              {loco.unitNumber} • {loco.horsepower} HP
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-chart-3/10 rounded-md">
                  <div>
                    <div className="text-sm text-muted-foreground">Payout</div>
                    <div className="text-2xl font-bold text-chart-3">
                      ${selectedJob.payout.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">XP Reward</div>
                    <div className="text-2xl font-bold text-chart-4">
                      +{selectedJob.xpReward} XP
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedJob(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAssignJob}
                  disabled={loading || selectedLocos.length === 0 || totalSelectedHP < selectedJob.hpRequired}
                  data-testid="button-assign-job"
                >
                  Assign Job
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {levelUpInfo && (
        <LevelUpNotification
          level={levelUpInfo.level}
          unlocks={levelUpInfo.unlocks}
          onClose={() => setLevelUpInfo(null)}
        />
      )}
    </>
  );
}
