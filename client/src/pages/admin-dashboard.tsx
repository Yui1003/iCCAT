import { useEffect } from "react";
import { useLocation } from "wouter";
import AdminLayout from "@/components/admin-layout";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation('/admin/buildings');
  }, [setLocation]);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">Redirecting...</div>
        </div>
      </div>
    </AdminLayout>
  );
}
