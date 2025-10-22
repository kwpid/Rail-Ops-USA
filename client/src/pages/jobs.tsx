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
import { MapPin, Package, Zap, DollarSign, Clock, Star, Lock, ArrowRight } from "lucide-react";
import type { Job } from "@shared/schema";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { calculateLevel, getXpForNextLevel } from "@shared/schema";
import { LevelUpNotification } from "@/components/level-up-notification";

// Sample jobs generator
const generateJobs = (tier: 1 | 2 | 3, baseCity: string): Job[] => {
  const cities = ["Atlanta, GA", "Charlotte, NC", "Memphis, TN", "Nashville, TN", "Birmingham, AL"];
  const freightTypes = [
    { type: "Boxcar (General Goods)", cars: 6 },
    { type: "Grain Hoppers", cars: 12 },
    { type: "Coal Hoppers", cars: 20 },
    { type: "Tank Cars (Chemicals)", cars: 8 },
    { type: "Intermodal", cars: 15 },
  ];

  const jobs: Job[] = [];
  const jobCount = tier === 1 ? 6 : tier === 2 ? 4 : 3;

  for (let i = 0; i < jobCount; i++) {
    const freight = freightTypes[Math.floor(Math.random() * freightTypes.length)];
    const distance = tier === 1 ? 20 + Math.random() * 50 : tier === 2 ? 80 + Math.random() * 120 : 200 + Math.random() * 300;
    const hpPerCar = tier === 1 ? 200 : tier === 2 ? 250 : 300;
    
    jobs.push({
      id: crypto.randomUUID(),
      jobId: `${tier === 1 ? "LCL" : tier === 2 ? "MLF" : "SPF"}-${String(i + 1).padStart(3, "0")}`,
      tier,
      origin: baseCity,
      destination: cities[Math.floor(Math.random() * cities.length)],
      distance: Math.floor(distance),
      freightType: freight.type,
      carCount: freight.cars,
      hpRequired: freight.cars * hpPerCar,
      payout: Math.floor(distance * freight.cars * (tier === 1 ? 20 : tier === 2 ? 35 : 60)),
      timeHours: Number((distance / 50).toFixed(1)),
      xpReward: Math.floor(distance * (tier === 1 ? 5 : tier === 2 ? 10 : 20)),
      status: "available",
    });
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

  if (!playerData || !user) return null;

  const stats = playerData.stats;
  const locomotives = playerData.locomotives;
  const company = playerData.company!;

  // Generate jobs if none exist - persist to Firestore
  useEffect(() => {
    const initializeJobs = async () => {
      if (playerData.jobs.length === 0) {
        const tier1 = generateJobs(1, company.city);
        const tier2 = stats.level >= 10 ? generateJobs(2, company.city) : [];
        const tier3 = stats.level >= 50 ? generateJobs(3, company.city) : [];
        
        try {
          const playerRef = doc(db, "players", user.uid);
          await updateDoc(playerRef, {
            jobs: [...tier1, ...tier2, ...tier3],
          });
          // onSnapshot in AuthContext will automatically update playerData
        } catch (error) {
          console.error("Error initializing jobs:", error);
        }
      }
    };

    initializeJobs();
  }, [playerData.jobs.length, company.city, stats.level, user.uid]);

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
      const completionTime = now + selectedJob.timeHours * 3600 * 1000;

      // Update job and locomotives
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

      // Auto-complete after time (for demo purposes, we'll complete immediately)
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

      // Update job to completed, free up locos, add cash and XP
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

      // Check for level up
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

  const tier1Jobs = playerData.jobs.filter((j) => j.tier === 1);
  const tier2Jobs = playerData.jobs.filter((j) => j.tier === 2);
  const tier3Jobs = playerData.jobs.filter((j) => j.tier === 3);

  const JobCard = ({ job }: { job: Job }) => (
    <Card
      className={`hover-elevate cursor-pointer ${job.status !== "available" ? "opacity-50" : ""}`}
      onClick={() => job.status === "available" && setSelectedJob(job)}
      data-testid={`card-job-${job.id}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-mono text-lg">{job.jobId}</CardTitle>
            <CardDescription>{job.freightType}</CardDescription>
          </div>
          <Badge variant={job.status === "available" ? "default" : job.status === "in_progress" ? "secondary" : "outline"}>
            {job.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{job.origin}</span>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{job.destination}</span>
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
            <span>{job.timeHours}h</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <span>{job.distance} mi</span>
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

  return (
    <>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-accent font-bold">Job Board</h1>
          <p className="text-muted-foreground">
            Available freight jobs from {company.city}
          </p>
        </div>

        <Tabs defaultValue="tier1">
          <TabsList>
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

      {/* Assign Locomotives Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="max-w-2xl">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-accent font-mono">
                  {selectedJob.jobId}
                </DialogTitle>
                <DialogDescription>{selectedJob.freightType}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-md">
                  <div>
                    <div className="text-sm text-muted-foreground">Route</div>
                    <div className="font-medium flex items-center gap-1">
                      <span>{selectedJob.origin}</span>
                      <ArrowRight className="w-4 h-4" />
                      <span>{selectedJob.destination}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Distance</div>
                    <div className="font-semibold">{selectedJob.distance} miles</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Car Count</div>
                    <div className="font-semibold">{selectedJob.carCount} cars</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Time</div>
                    <div className="font-semibold">{selectedJob.timeHours} hours</div>
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

      {/* Level Up Notification */}
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
