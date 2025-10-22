import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Train,
  Briefcase,
  Store,
  ShoppingCart,
  Newspaper,
  LogOut,
  DollarSign,
  Star,
  TrendingUp,
  Menu,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { calculateLevel, getXpForNextLevel } from "@shared/schema";

const menuItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { title: "Inventory", icon: Train, path: "/inventory" },
  { title: "Jobs", icon: Briefcase, path: "/jobs" },
  { title: "Shop", icon: Store, path: "/shop" },
  { title: "Loaner Trains", icon: ShoppingCart, path: "/loaner-trains" },
  { title: "News", icon: Newspaper, path: "/news" },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { playerData, signOut, user } = useAuth();
  const [location] = useLocation();

  if (!playerData || !user) return null;

  const stats = playerData.stats;
  const company = playerData.company;
  const currentXp = stats.xp;
  const currentLevel = stats.level;
  const nextLevelXp = getXpForNextLevel(currentLevel);
  const xpProgress = currentLevel === 1 ? 0 : ((currentXp - getXpForNextLevel(currentLevel - 1)) / (nextLevelXp - getXpForNextLevel(currentLevel - 1))) * 100;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-lg font-accent font-bold px-4">
                {company?.name || "Rail Ops"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.path}>
                            <Icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          {/* Top Stats Bar */}
          <header className="flex items-center justify-between gap-4 p-4 border-b bg-card flex-wrap">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Separator orientation="vertical" className="h-6" />
              <span className="font-accent font-semibold text-lg">
                {company?.name}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {company?.city}
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Cash */}
              <div className="flex items-center gap-2 px-3 py-1 bg-background rounded-md">
                <DollarSign className="w-4 h-4 text-chart-3" />
                <span className="font-mono font-semibold" data-testid="text-cash">
                  ${stats.cash.toLocaleString()}
                </span>
              </div>

              {/* XP & Level */}
              <div className="flex items-center gap-3 px-3 py-1 bg-background rounded-md">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-chart-4" />
                  <span className="font-semibold" data-testid="text-level">
                    Level {stats.level}
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2 min-w-[100px]">
                  <Progress value={xpProgress} className="h-2 w-20" />
                  <span className="text-xs text-muted-foreground font-mono" data-testid="text-xp">
                    {currentXp}/{nextLevelXp}
                  </span>
                </div>
              </div>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-user-menu">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold">
                          {user.displayName?.[0] || "U"}
                        </span>
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{user.displayName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} data-testid="button-signout">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
