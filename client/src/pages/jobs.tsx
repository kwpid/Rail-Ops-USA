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
import { FREIGHT_TYPES, generateLoanerTrainMarket } from "@shared/schema";
import { doc, updateDoc, deleteField } from "firebase/firestore";
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
      const distance = 5 + Math.random() * 11; // Short local distances (5-15 miles after floor)
      const carCount = 4 + Math.floor(Math.random() * 8);
      // Local freight is always manifest (mixed cargo)
      const manifest = generateManifest("Mixed Manifest", carCount);
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
        freightType: "Mixed Manifest",
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
    const jobCount = 8; // Spawn more mainline jobs
    for (let i = 0; i < jobCount; i++) {
      const destination = otherCities[Math.floor(Math.random() * otherCities.length)];
      const freightType = FREIGHT_TYPES[Math.floor(Math.random() * FREIGHT_TYPES.length)];
      const distance = 80 + Math.random() * 120;
      const carCount = 15 + Math.floor(Math.random() * 136); // Up to 150 cars
      const manifest = generateManifest(freightType.type, carCount);
      
      // Calculate HP based on manifest weight and car count
      const totalWeight = manifest.reduce((sum, item) => sum + (item.weight * item.count), 0);
      const hpRequired = Math.floor(totalWeight * 1.5); // 1.5 HP per ton
      
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
  const [currentTime, setCurrentTime] = useState(Date.now());

  if (!playerData || !user) return null;

  const stats = playerData.stats;
  const locomotives = playerData.locomotives;
  const company = playerData.company!;

  useEffect(() => {
    const initializeJobsAndMarket = async () => {
      const updates: any = {};
      
      // Initialize jobs if none exist
      if (playerData.jobs.length === 0) {
        // Spawn all tiers regardless of level (level gating only prevents assignment)
        const tier1 = generateJobs(1, company.city, stats.level);
        const tier2 = generateJobs(2, company.city, stats.level);
        const tier3 = generateJobs(3, company.city, stats.level);
        updates.jobs = [...tier1, ...tier2, ...tier3];
      }
      
      // Initialize loaner trains if none exist
      if (!playerData.loanerTrains || playerData.loanerTrains.length === 0) {
        const initialLoanerTrains = generateLoanerTrainMarket();
        const nextRefreshTimestamp = Date.now() + (30 * 60 * 1000); // 30 minutes from now
        updates.loanerTrains = initialLoanerTrains;
        updates.loanerTrainsRefreshAt = nextRefreshTimestamp;
      }
      
      // Only update if we have changes
      if (Object.keys(updates).length > 0) {
        try {
          const playerRef = doc(db, "players", user.uid);
          await updateDoc(playerRef, updates);
        } catch (error) {
          console.error("Error initializing market:", error);
        }
      }
    };

    initializeJobsAndMarket();
  }, [playerData.jobs.length, playerData.loanerTrains, company.city, stats.level, user.uid]);

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
      
      // Refresh jobs - keep ongoing jobs, generate new available jobs for all tiers
      const ongoingJobs = playerData.jobs.filter(j => j.status === "in_progress");
      const tier1 = generateJobs(1, company.city, stats.level);
      const tier2 = generateJobs(2, company.city, stats.level);
      const tier3 = generateJobs(3, company.city, stats.level);
      
      // Also refresh loaner trains (2-7 random locomotives)
      const newLoanerTrains = generateLoanerTrainMarket();
      const nextRefreshTimestamp = now.getTime() + (30 * 60 * 1000); // 30 minutes from now
      
      try {
        const playerRef = doc(db, "players", user.uid);
        await updateDoc(playerRef, {
          jobs: [...ongoingJobs, ...tier1, ...tier2, ...tier3],
          loanerTrains: newLoanerTrains,
          loanerTrainsRefreshAt: nextRefreshTimestamp,
        });
        
        toast({
          title: "Market Refreshed",
          description: `New freight opportunities and ${newLoanerTrains.length} used locomotives available`,
        });
      } catch (error) {
        console.error("Error refreshing market:", error);
      }
    };

    // Check every minute
    const interval = setInterval(checkAndRefreshJobs, 60 * 1000);
    
    // Also check immediately on mount
    checkAndRefreshJobs();
    
    return () => clearInterval(interval);
  }, [playerData.jobs, company.city, stats.level, user.uid, toast]);

  // Update current time every second to re-render job progress
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const availableLocos = locomotives.filter((l) => l.status === "available");
  const totalSelectedHP = selectedLocos.reduce((sum, id) => {
    const loco = locomotives.find((l) => l.id === id);
    return sum + (loco?.horsepower || 0);
  }, 0);

  // Assign random locomotives for a job
  const handleAssignRandom = () => {
    if (!selectedJob) return;
    
    // Check tier requirement
    const tierRequirement = selectedJob.tier === 2 ? 10 : selectedJob.tier === 3 ? 50 : 0;
    if (stats.level < tierRequirement) {
      toast({
        title: "Job Locked",
        description: `This job requires Level ${tierRequirement}. You are Level ${stats.level}.`,
        variant: "destructive",
      });
      return;
    }
    
    // Sort available locos by horsepower (descending)
    const sortedLocos = [...availableLocos].sort((a, b) => b.horsepower - a.horsepower);
    
    // Select locos until we meet HP requirement
    const selected: string[] = [];
    let totalHP = 0;
    
    for (const loco of sortedLocos) {
      if (totalHP >= selectedJob.hpRequired) break;
      selected.push(loco.id);
      totalHP += loco.horsepower;
    }
    
    // Randomly decide whether to add one more loco (if available and randomly chosen)
    if (totalHP >= selectedJob.hpRequired && selected.length < sortedLocos.length && Math.random() > 0.7) {
      const remainingLocos = sortedLocos.filter(l => !selected.includes(l.id));
      if (remainingLocos.length > 0) {
        const randomLoco = remainingLocos[Math.floor(Math.random() * remainingLocos.length)];
        selected.push(randomLoco.id);
      }
    }
    
    if (totalHP < selectedJob.hpRequired) {
      toast({
        title: "Insufficient Horsepower",
        description: `This job requires ${selectedJob.hpRequired} HP. You only have ${totalHP} HP available.`,
        variant: "destructive",
      });
      return;
    }
    
    setSelectedLocos(selected);
    toast({
      title: "Locomotives Selected",
      description: `${selected.length} locomotive(s) selected with ${totalHP.toLocaleString()} HP`,
    });
  };

  const handleAssignJob = async () => {
    if (!selectedJob || selectedLocos.length === 0) return;

    // Check tier requirement
    const tierRequirement = selectedJob.tier === 2 ? 10 : selectedJob.tier === 3 ? 50 : 0;
    if (stats.level < tierRequirement) {
      toast({
        title: "Job Locked",
        description: `This job requires Level ${tierRequirement}. You are Level ${stats.level}.`,
        variant: "destructive",
      });
      return;
    }

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

  const handleClaimJob = async (jobId: string) => {
    try {
      const playerRef = doc(db, "players", user.uid);
      const job = playerData.jobs.find((j) => j.id === jobId);
      if (!job || job.status !== "in_progress") return;

      const newCash = stats.cash + job.payout;
      const newXp = stats.xp + job.xpReward;
      const oldLevel = stats.level;
      const newLevel = calculateLevel(newXp);

      // Remove the completed job and free up locomotives
      const updatedJobs = playerData.jobs.filter((j) => j.id !== jobId);

      const updatedLocos = locomotives.map((l) => {
        if (l.assignedJobId === jobId) {
          const { assignedJobId, ...locoWithoutJobId } = l;
          return { ...locoWithoutJobId, status: "available" as const };
        }
        return l;
      });

      await updateDoc(playerRef, {
        jobs: updatedJobs,
        locomotives: updatedLocos,
        "stats.cash": newCash,
        "stats.xp": newXp,
        "stats.level": newLevel,
      });

      await refreshPlayerData();

      toast({
        title: "Rewards Claimed!",
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
      toast({
        title: "Error",
        description: "Failed to claim job rewards",
        variant: "destructive",
      });
    }
  };

  const availableJobs = playerData.jobs.filter((j) => j.status === "available");
  const currentJobs = playerData.jobs.filter((j) => j.status === "in_progress");
  const tier1Jobs = availableJobs.filter((j) => j.tier === 1);
  const tier2Jobs = availableJobs.filter((j) => j.tier === 2);
  const tier3Jobs = availableJobs.filter((j) => j.tier === 3);

  // Calculate next job refresh time
  const getNextRefreshTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const nextRefresh = new Date(now);
    
    if (minutes < 30) {
      // Next refresh is at :30 of this hour
      nextRefresh.setMinutes(30, 0, 0);
    } else {
      // Next refresh is at :00 of next hour
      nextRefresh.setHours(nextRefresh.getHours() + 1);
      nextRefresh.setMinutes(0, 0, 0);
    }
    
    return nextRefresh;
  };

  const nextRefreshTime = getNextRefreshTime();
  const timeUntilRefresh = Math.max(0, nextRefreshTime.getTime() - currentTime);
  const minutesUntilRefresh = Math.floor(timeUntilRefresh / 60000);
  const secondsUntilRefresh = Math.floor((timeUntilRefresh % 60000) / 1000);

  // Sort locomotives: selected ones first, then by horsepower
  const sortedAvailableLocos = [...availableLocos].sort((a, b) => {
    const aSelected = selectedLocos.includes(a.id);
    const bSelected = selectedLocos.includes(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return b.horsepower - a.horsepower; // Sort by HP descending within each group
  });

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
    const progress = job.completesAt && job.startedAt
      ? Math.min(100, ((currentTime - job.startedAt) / (job.completesAt - job.startedAt)) * 100)
      : 0;
    const timeRemaining = job.completesAt ? Math.max(0, job.completesAt - currentTime) : 0;
    const minutesRemaining = Math.ceil(timeRemaining / 60000);
    const isCompleted = timeRemaining === 0;

    // Get assigned locomotives for this job
    const assignedLocos = locomotives.filter(l => job.assignedLocos?.includes(l.id));
    const locoNumbers = assignedLocos.map(l => l.unitNumber).join(", ");

    return (
      <Card className="hover-elevate">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="font-mono text-lg">{job.jobId}</CardTitle>
              <CardDescription>{job.freightType}</CardDescription>
            </div>
            <Badge variant={isCompleted ? "default" : "secondary"}>
              {isCompleted ? "Complete" : "In Progress"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{job.origin}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{job.destination}</span>
          </div>

          {locoNumbers && (
            <div className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
              <Zap className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Locomotives:</span>
              <span className="font-mono font-medium">{locoNumbers}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {isCompleted ? "Complete!" : `${minutesRemaining} min remaining`}
              </span>
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

          {isCompleted && (
            <Button 
              className="w-full" 
              onClick={() => handleClaimJob(job.id)}
              data-testid={`button-claim-${job.id}`}
            >
              <Package className="w-4 h-4 mr-2" />
              Claim Rewards
            </Button>
          )}
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-accent font-bold">Job Board</h1>
            <p className="text-muted-foreground">
              Available freight jobs from {company.city}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            <div className="text-sm">
              <div className="text-muted-foreground">Next refresh in</div>
              <div className="font-mono font-semibold">
                {minutesUntilRefresh}:{secondsUntilRefresh.toString().padStart(2, '0')}
              </div>
            </div>
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
            <TabsTrigger value="tier2" data-testid="tab-tier2" disabled={stats.level < 10}>
              Mainline Freight {stats.level < 10 && <Lock className="w-3 h-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="tier3" data-testid="tab-tier3" disabled={stats.level < 50}>
              Special Freight {stats.level < 50 && <Lock className="w-3 h-3 ml-1" />}
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
                      sortedAvailableLocos.map((loco) => (
                        <div
                          key={loco.id}
                          className={`flex items-center gap-3 p-3 border rounded-md hover-elevate ${
                            selectedLocos.includes(loco.id) ? "bg-primary/10 border-primary" : ""
                          }`}
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

              <DialogFooter className="flex items-center justify-between">
                <Button 
                  variant="secondary" 
                  onClick={handleAssignRandom}
                  disabled={loading || availableLocos.length === 0}
                  data-testid="button-assign-random"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Assign Random
                </Button>
                <div className="flex gap-2">
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
                </div>
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
