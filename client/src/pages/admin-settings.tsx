import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Loader2, Power, Download, Trash2 } from "lucide-react";
import AdminLayout from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { invalidateEndpointCache } from "@/lib/offline-data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Setting {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

const settingsFormSchema = z.object({
  homeTimeout: z.string()
    .refine((val) => !isNaN(parseInt(val, 10)), {
      message: "Must be a valid number"
    })
    .refine((val) => {
      const num = parseInt(val, 10);
      return num >= 1 && num <= 300;
    }, {
      message: "Timeout must be between 1 and 300 seconds"
    }),
  globalTimeout: z.string()
    .refine((val) => !isNaN(parseInt(val, 10)), {
      message: "Must be a valid number"
    })
    .refine((val) => {
      const num = parseInt(val, 10);
      return num >= 30 && num <= 600;
    }, {
      message: "Timeout must be between 30 and 600 seconds (0.5 to 10 minutes)"
    })
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function AdminSettings() {
  const { toast } = useToast();
  const [showShutdownDialog, setShowShutdownDialog] = useState(false);
  const [showClearFeedbackDialog, setShowClearFeedbackDialog] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      homeTimeout: "30",
      globalTimeout: "180"
    }
  });

  // Fetch current home timeout setting
  const { data: homeTimeoutSetting, isLoading: isLoadingHome, error: homeError } = useQuery<Setting>({
    queryKey: ['/api/settings/home_inactivity_timeout'],
    queryFn: async () => {
      const response = await fetch('/api/settings/home_inactivity_timeout');
      if (response.status === 404) {
        // Setting doesn't exist yet, return null to use default
        return null;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch setting');
      }
      return response.json();
    }
  });

  // Fetch current global timeout setting
  const { data: globalTimeoutSetting, isLoading: isLoadingGlobal, error: globalError } = useQuery<Setting>({
    queryKey: ['/api/settings/global_inactivity_timeout'],
    queryFn: async () => {
      const response = await fetch('/api/settings/global_inactivity_timeout');
      if (response.status === 404) {
        // Setting doesn't exist yet, return null to use default
        return null;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch setting');
      }
      return response.json();
    }
  });

  const isLoading = isLoadingHome || isLoadingGlobal;
  const error = homeError || globalError;

  useEffect(() => {
    // Reset form when data is loaded (even if settings are null/don't exist)
    if (!isLoading && !error) {
      form.reset({
        homeTimeout: homeTimeoutSetting?.value || "30",
        globalTimeout: globalTimeoutSetting?.value || "180"
      });
    }
  }, [homeTimeoutSetting, globalTimeoutSetting, isLoading, error, form]);

  // Update timeout mutation
  const updateTimeoutMutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      // Update home timeout
      const homeResponse = await fetch('/api/settings/home_inactivity_timeout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: values.homeTimeout })
      });
      
      if (!homeResponse.ok) {
        const errorData = await homeResponse.json();
        throw new Error(errorData.error || 'Failed to update home timeout');
      }

      // Update global timeout
      const globalResponse = await fetch('/api/settings/global_inactivity_timeout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: values.globalTimeout })
      });
      
      if (!globalResponse.ok) {
        const errorData = await globalResponse.json();
        throw new Error(errorData.error || 'Failed to update global timeout');
      }
      
      return { home: await homeResponse.json(), global: await globalResponse.json() };
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateEndpointCache('/api/settings/home_inactivity_timeout', queryClient),
        invalidateEndpointCache('/api/settings/global_inactivity_timeout', queryClient)
      ]);
      toast({
        title: "Settings Updated",
        description: "Inactivity timeouts have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: SettingsFormValues) => {
    updateTimeoutMutation.mutate(values);
  };

  // Shutdown kiosk mutation
  const shutdownMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/shutdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to shutdown kiosk');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Shutting Down",
        description: "The kiosk system is shutting down now...",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Shutdown Failed",
        description: error.message || "Failed to shutdown the kiosk. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleShutdown = () => {
    setShowShutdownDialog(false);
    shutdownMutation.mutate();
  };

  // Clear all feedback mutation (TESTING ONLY)
  const clearFeedbackMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/feedback/clear-all', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear feedback');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback Cleared",
        description: "All feedback records have been permanently deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Clear Failed",
        description: error.message || "Failed to clear feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClearFeedback = () => {
    setShowClearFeedbackDialog(false);
    clearFeedbackMutation.mutate();
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-8 h-8 text-foreground" />
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        </div>

        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Homepage Inactivity Timeout</CardTitle>
              <CardDescription>
                Configure how long the homepage should wait before showing the screensaver (in seconds)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading settings...</span>
                </div>
              ) : error ? (
                <div className="text-destructive py-4">
                  Failed to load settings. Please refresh the page.
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="homeTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Homepage Timeout (seconds)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="300"
                              placeholder="30"
                              data-testid="input-home-timeout"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Enter a value between 1 and 300 seconds. Default is 30 seconds.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="pt-4 border-t border-border">
                      <h3 className="text-lg font-medium mb-2">Page Inactivity Timeout</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Configure how long other pages should wait before returning to homepage due to inactivity
                      </p>
                      
                      <FormField
                        control={form.control}
                        name="globalTimeout"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Page Timeout (seconds)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="30"
                                max="600"
                                placeholder="180"
                                data-testid="input-global-timeout"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Enter a value between 30 and 600 seconds (0.5 to 10 minutes). Default is 180 seconds (3 minutes).
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={updateTimeoutMutation.isPending}
                      data-testid="button-save-settings"
                    >
                      {updateTimeoutMutation.isPending && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      {updateTimeoutMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Feedback Management
              </CardTitle>
              <CardDescription>
                Download user feedback data in Excel format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Export all submitted feedback responses with calculated category averages to an Excel spreadsheet.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="default"
                  onClick={() => window.location.href = '/api/feedback/export'}
                  data-testid="button-download-feedback"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Feedback Excel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowClearFeedbackDialog(true)}
                  disabled={clearFeedbackMutation.isPending}
                  data-testid="button-clear-all-feedback"
                  className="gap-2"
                >
                  {clearFeedbackMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  <Trash2 className="w-4 h-4" />
                  Clear All Feedback (TESTING ONLY)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Power className="w-5 h-5" />
                Kiosk System Shutdown
              </CardTitle>
              <CardDescription>
                Shut down the entire kiosk system (Windows PC)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                This will shut down the entire Windows PC, not just the web application. 
                The system will need to be manually powered on again.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowShutdownDialog(true)}
                disabled={shutdownMutation.isPending}
                data-testid="button-shutdown-kiosk"
              >
                {shutdownMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                <Power className="w-4 h-4 mr-2" />
                {shutdownMutation.isPending ? "Shutting Down..." : "Shutdown Kiosk"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showShutdownDialog} onOpenChange={setShowShutdownDialog}>
        <AlertDialogContent data-testid="dialog-shutdown-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Power className="w-5 h-5" />
              Confirm System Shutdown
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to shut down the entire kiosk system?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Close the web application</li>
                <li>Shut down the Windows PC completely</li>
                <li>Require manual power-on to restart</li>
              </ul>
              <br />
              <strong>This action cannot be undone remotely.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-shutdown">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleShutdown}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-shutdown"
            >
              <Power className="w-4 h-4 mr-2" />
              Shutdown Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearFeedbackDialog} onOpenChange={setShowClearFeedbackDialog}>
        <AlertDialogContent data-testid="dialog-clear-feedback-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Clear All Feedback - TESTING ONLY
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-destructive">⚠️ DANGER: This action is PERMANENT and IRREVERSIBLE!</strong>
              <br />
              <br />
              Are you absolutely sure you want to delete ALL feedback records?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Permanently delete all user feedback submissions</li>
                <li>Remove all ratings and comments from the database</li>
                <li>Reset the user number counter to zero</li>
                <li>Cannot be undone - data will be lost forever</li>
              </ul>
              <br />
              <strong className="text-destructive">
                This feature is for TESTING purposes only and should NEVER be used in production!
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear-feedback">
              Cancel (Keep Feedback)
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearFeedback}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-2"
              data-testid="button-confirm-clear-feedback"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
