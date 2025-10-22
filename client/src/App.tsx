import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/main-layout";
import AuthPage from "@/pages/auth-page";
import CompanyCreation from "@/pages/company-creation";
import Dashboard from "@/pages/dashboard";
import Inventory from "@/pages/inventory";
import Jobs from "@/pages/jobs";
import Shop from "@/pages/shop";
import LoanerTrains from "@/pages/loaner-trains";
import News from "@/pages/news";
import NotFound from "@/pages/not-found";

function AppRouter() {
  const { user, playerData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading Rail Ops: USA...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!playerData?.company) {
    return <CompanyCreation />;
  }

  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/shop" component={Shop} />
        <Route path="/loaner-trains" component={LoanerTrains} />
        <Route path="/news" component={News} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
