import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import {
  Building2,
  Route,
  Users,
  Calendar,
  Layers,
  LogOut,
  Map,
  Settings
} from "lucide-react";
import { Button } from "./ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "./ui/sidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAdminAuthenticated');
    if (!isAuthenticated) {
      setLocation('/admin/login');
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem('isAdminAuthenticated');
    setLocation('/');
  };

  const menuItems = [
    {
      title: "Buildings",
      url: "/admin/buildings",
      icon: Building2,
    },
    {
      title: "Paths",
      url: "/admin/paths",
      icon: Route,
    },
    {
      title: "Floor Plans",
      url: "/admin/floor-plans",
      icon: Layers,
    },
    {
      title: "Staff",
      url: "/admin/staff",
      icon: Users,
    },
    {
      title: "Events",
      url: "/admin/events",
      icon: Calendar,
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: Settings,
    },
  ];

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
              <div className="px-4 py-6 border-b border-sidebar-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
                    <Map className="w-6 h-6 text-sidebar-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-sidebar-foreground">iCCAT Admin</h2>
                    <p className="text-xs text-sidebar-foreground/70">Management Panel</p>
                  </div>
                </div>
              </div>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}>
                        <Link href={item.url}>
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout} data-testid="button-logout">
                      <LogOut className="w-5 h-5" />
                      <span>Logout</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
