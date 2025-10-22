import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Train, AlertCircle } from "lucide-react";
import { useState } from "react";
import { firebaseConfigured } from "@/lib/firebase";

export default function AuthPage() {
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      
      <Card className="relative z-10 w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
            <Train className="w-10 h-10 text-primary" />
          </div>
          
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold font-accent text-foreground">
              Rail Ops: USA
            </h1>
            <p className="text-muted-foreground text-sm">
              Build and manage your railroad empire across America
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          {!firebaseConfigured && (
            <Alert variant="destructive" data-testid="alert-firebase-config">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Firebase authentication is not configured. Please set up your Firebase environment variables to enable sign-in.
              </AlertDescription>
            </Alert>
          )}
          
          <Button
            onClick={handleSignIn}
            disabled={isLoading || !firebaseConfigured}
            className="w-full"
            size="lg"
            data-testid="button-google-signin"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Sign in to create your railroad company and start hauling freight
          </p>
        </div>
      </Card>
    </div>
  );
}
