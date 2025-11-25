import { useState } from "react";
import { useLocation } from "wouter";
import { Map, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        localStorage.setItem('isAdminAuthenticated', 'true');
        toast({
          title: "Login Successful",
          description: "Welcome to the admin panel",
        });
        setLocation("/admin/dashboard");
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid username or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/5 flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-lg mb-4">
            <Map className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Access</h1>
          <p className="text-muted-foreground">Sign in to manage the kiosk system</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label htmlFor="username" className="text-base">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-2 h-12"
              placeholder="Enter your username"
              required
              data-testid="input-username"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-base">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 h-12"
              placeholder="Enter your password"
              required
              data-testid="input-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12"
            disabled={isLoading}
            data-testid="button-login"
          >
            <LogIn className="w-5 h-5 mr-2" />
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-back-home"
            >
              ← Back to Kiosk
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
