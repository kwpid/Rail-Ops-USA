import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Train, Briefcase, Store, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { playerData } = useAuth();

  if (!playerData) return null;

  const stats = playerData.stats;
  const locomotives = playerData.locomotives;
  const jobs = playerData.jobs;

  const availableLocos = locomotives.filter((l) => l.status === "available").length;
  const activeJobs = jobs.filter((j) => j.status === "in_progress").length;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-accent font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back to {playerData.company?.name}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locomotives</CardTitle>
            <Train className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-locos">
              {locomotives.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {availableLocos} available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Briefcase className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-jobs">
              {activeJobs}
            </div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats.cash + locomotives.reduce((sum, l) => sum + l.resaleValue, 0)).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Cash + Assets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Experience</CardTitle>
            <Store className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-xp">
              {stats.xp.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Level {stats.level}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Assign Jobs
            </CardTitle>
            <CardDescription>
              Browse available freight jobs and assign locomotives
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/jobs">
              <Button className="w-full" data-testid="button-view-jobs">
                View Job Board
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              Expand Fleet
            </CardTitle>
            <CardDescription>
              Purchase new locomotives to grow your operation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/shop">
              <Button className="w-full" data-testid="button-view-shop">
                Visit Shop
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Train className="w-5 h-5" />
              Manage Fleet
            </CardTitle>
            <CardDescription>
              View and customize your locomotive roster
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/inventory">
              <Button className="w-full" data-testid="button-view-inventory">
                View Inventory
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
