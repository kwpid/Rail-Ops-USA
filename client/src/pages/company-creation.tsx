import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCOMOTIVE_CATALOG, US_CITIES } from "@shared/schema";
import { doc } from "firebase/firestore";
import { getDbOrThrow, safeUpdateDoc } from "@/lib/firebase";
import { Loader2, Building2, MapPin, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PRESET_COLORS = [
  { name: "Railroad Blue", primary: "#1e3a8a", secondary: "#dbeafe" },
  { name: "Industrial Orange", primary: "#ea580c", secondary: "#fed7aa" },
  { name: "Forest Green", primary: "#166534", secondary: "#bbf7d0" },
  { name: "Steel Gray", primary: "#475569", secondary: "#cbd5e1" },
  { name: "Coal Black", primary: "#0f172a", secondary: "#e2e8f0" },
  { name: "Signal Red", primary: "#dc2626", secondary: "#fecaca" },
];

export default function CompanyCreation() {
  const { user, refreshPlayerData } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  const [companyName, setCompanyName] = useState("");
  const [city, setCity] = useState("");
  const [selectedColorPreset, setSelectedColorPreset] = useState(0);

  const handleSubmit = async () => {
    if (!companyName || !city || !user) return;

    setLoading(true);
    try {
      const preset = PRESET_COLORS[selectedColorPreset];
      const starterLoco = LOCOMOTIVE_CATALOG[0]; // EMD GP38-2

      const db = getDbOrThrow();
      const playerRef = doc(db, "players", user.uid);
      await safeUpdateDoc(playerRef, {
        company: {
          name: companyName,
          city,
          primaryColor: preset.primary,
          secondaryColor: preset.secondary,
          createdAt: Date.now(),
        },
        locomotives: [
          {
            id: crypto.randomUUID(),
            unitNumber: "#0001",
            model: starterLoco.model,
            manufacturer: starterLoco.manufacturer,
            tier: starterLoco.tier,
            horsepower: starterLoco.horsepower,
            topSpeed: starterLoco.topSpeed,
            weight: starterLoco.weight,
            tractiveEffort: starterLoco.tractiveEffort,
            fuelCapacity: starterLoco.fuelCapacity,
            fuelEfficiency: starterLoco.fuelEfficiency,
            reliability: starterLoco.reliability,
            maintenanceCost: starterLoco.maintenanceCost,
            purchaseCost: starterLoco.purchaseCost,
            resaleValue: starterLoco.resaleValue,
            scrapValue: Math.floor(starterLoco.purchaseCost * 0.3),
            mileage: 0,
            paintCondition: 100,
            status: "available",
            purchasedAt: Date.now(),
            notes: starterLoco.notes,
          },
        ],
      });

      await refreshPlayerData();
      
      toast({
        title: "Company Created!",
        description: `Welcome to ${companyName}. Your starter locomotive is ready.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to create company. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-3xl font-accent">Create Your Railroad Company</CardTitle>
          <CardDescription>
            Step {step} of 3 - Set up your freight operation
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company Name
                </Label>
                <Input
                  id="company-name"
                  placeholder="e.g., Midwest Rail Services"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  maxLength={50}
                  data-testid="input-company-name"
                />
                <p className="text-xs text-muted-foreground">
                  Choose a name for your railroad company
                </p>
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!companyName}
                className="w-full"
                data-testid="button-next-step"
              >
                Next: Choose Location
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Home Base City
                </Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger id="city" data-testid="select-city">
                    <SelectValue placeholder="Select a city" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_CITIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Your primary operating hub for freight operations
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!city}
                  className="flex-1"
                  data-testid="button-next-step"
                >
                  Next: Choose Colors
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Company Colors
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {PRESET_COLORS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedColorPreset(idx)}
                      className={`p-3 rounded-md border-2 transition-all hover-elevate ${
                        selectedColorPreset === idx
                          ? "border-primary"
                          : "border-border"
                      }`}
                      data-testid={`button-color-${idx}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <div
                            className="w-6 h-6 rounded"
                            style={{ backgroundColor: preset.secondary }}
                          />
                        </div>
                        <span className="text-sm font-medium">{preset.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-muted rounded-md space-y-2">
                <p className="text-sm font-medium">Preview</p>
                <div className="flex items-center gap-2">
                  <div
                    className="px-3 py-1 rounded text-sm font-medium"
                    style={{
                      backgroundColor: PRESET_COLORS[selectedColorPreset].primary,
                      color: "#fff",
                    }}
                  >
                    {companyName}
                  </div>
                  <span className="text-sm text-muted-foreground">{city}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1"
                  data-testid="button-create-company"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Company"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
