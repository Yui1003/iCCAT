import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/admin-layout";
import type { Building, Floor, IndoorNode } from "@shared/schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AdminIndoorNodes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<IndoorNode | null>(null);
  const [deletingNode, setDeletingNode] = useState<IndoorNode | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [nodeType, setNodeType] = useState<string>("entrance");
  const [nodeLabel, setNodeLabel] = useState("");
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [connectedFloorIds, setConnectedFloorIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: buildings = [] } = useQuery<Building[]>({
    queryKey: ['/api/buildings']
  });

  const { data: floors = [] } = useQuery<Floor[]>({
    queryKey: ['/api/floors']
  });

  const { data: indoorNodes = [] } = useQuery<IndoorNode[]>({
    queryKey: ['/api/indoor-nodes']
  });

  const floorsForBuilding = floors.filter(f => f.buildingId === selectedBuildingId);
  const nodesForFloor = indoorNodes.filter(n => n.floorId === selectedFloorId);

  const createIndoorNode = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/indoor-nodes', data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/indoor-nodes'] });
      toast({ title: "Indoor node created successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Failed to create indoor node", variant: "destructive" });
    }
  });

  const updateIndoorNode = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest('PUT', `/api/indoor-nodes/${id}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/indoor-nodes'] });
      toast({ title: "Indoor node updated successfully" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "Failed to update indoor node", variant: "destructive" });
    }
  });

  const deleteIndoorNode = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/indoor-nodes/${id}`, null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/indoor-nodes'] });
      toast({ title: "Indoor node deleted successfully" });
      setDeletingNode(null);
    },
    onError: () => {
      toast({ title: "Failed to delete indoor node", variant: "destructive" });
    }
  });

  const handleOpenDialog = (node?: IndoorNode) => {
    if (node) {
      setEditingNode(node);
      setSelectedFloorId(node.floorId);
      const floor = floors.find(f => f.id === node.floorId);
      if (floor) {
        setSelectedBuildingId(floor.buildingId);
      }
      setNodeType(node.type);
      setNodeLabel(node.label || "");
      setX(node.x.toString());
      setY(node.y.toString());
      setConnectedFloorIds(node.connectedFloorIds || []);
    } else {
      setEditingNode(null);
      setNodeType("entrance");
      setNodeLabel("");
      setX("");
      setY("");
      setConnectedFloorIds([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingNode(null);
    setNodeType("entrance");
    setNodeLabel("");
    setX("");
    setY("");
    setConnectedFloorIds([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFloorId) {
      toast({ title: "Please select a floor", variant: "destructive" });
      return;
    }

    if (!x || !y) {
      toast({ title: "Please enter x and y coordinates", variant: "destructive" });
      return;
    }

    const data = {
      floorId: selectedFloorId,
      type: nodeType,
      x: parseFloat(x),
      y: parseFloat(y),
      label: nodeLabel || null,
      connectedFloorIds: connectedFloorIds.length > 0 ? connectedFloorIds : [],
      roomId: null,
      connectedBuildingNodeId: null
    };

    if (editingNode) {
      updateIndoorNode.mutate({ id: editingNode.id, data });
    } else {
      createIndoorNode.mutate(data);
    }
  };

  const filteredNodes = nodesForFloor.filter(node => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (node.label?.toLowerCase().includes(searchLower)) ||
           (node.type.toLowerCase().includes(searchLower));
  });

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'entrance': return 'bg-orange-500';
      case 'stairway': return 'bg-purple-500';
      case 'elevator': return 'bg-pink-500';
      case 'hallway': return 'bg-gray-500';
      case 'room': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Indoor Node Management</h1>
            <p className="text-muted-foreground">Create entrance, stairway, and elevator nodes for indoor navigation</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => open ? handleOpenDialog() : handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-indoor-node">
                <Plus className="w-4 h-4 mr-2" />
                Add Node
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingNode ? 'Edit' : 'Add'} Indoor Node</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Create nodes for entrances, stairways, elevators, or hallways on floor plans
                </p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="building">Building</Label>
                    <Select 
                      value={selectedBuildingId} 
                      onValueChange={(value) => {
                        setSelectedBuildingId(value);
                        setSelectedFloorId("");
                      }}
                    >
                      <SelectTrigger data-testid="select-building">
                        <SelectValue placeholder="Select building" />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map(building => (
                          <SelectItem key={building.id} value={building.id}>
                            {building.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="floor">Floor</Label>
                    <Select 
                      value={selectedFloorId} 
                      onValueChange={setSelectedFloorId}
                      disabled={!selectedBuildingId}
                    >
                      <SelectTrigger data-testid="select-floor">
                        <SelectValue placeholder="Select floor" />
                      </SelectTrigger>
                      <SelectContent>
                        {floorsForBuilding.map(floor => (
                          <SelectItem key={floor.id} value={floor.id}>
                            {floor.floorName || `Floor ${floor.floorNumber}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nodeType">Node Type</Label>
                    <Select value={nodeType} onValueChange={setNodeType}>
                      <SelectTrigger data-testid="select-node-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrance">Entrance</SelectItem>
                        <SelectItem value="stairway">Stairway</SelectItem>
                        <SelectItem value="elevator">Elevator</SelectItem>
                        <SelectItem value="hallway">Hallway</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="label">Label (Optional)</Label>
                    <Input
                      id="label"
                      value={nodeLabel}
                      onChange={(e) => setNodeLabel(e.target.value)}
                      placeholder="e.g., Main Entrance"
                      data-testid="input-node-label"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="x">X Coordinate (pixels)</Label>
                    <Input
                      id="x"
                      type="number"
                      value={x}
                      onChange={(e) => setX(e.target.value)}
                      placeholder="0"
                      required
                      data-testid="input-x"
                    />
                  </div>
                  <div>
                    <Label htmlFor="y">Y Coordinate (pixels)</Label>
                    <Input
                      id="y"
                      type="number"
                      value={y}
                      onChange={(e) => setY(e.target.value)}
                      placeholder="0"
                      required
                      data-testid="input-y"
                    />
                  </div>
                </div>

                {(nodeType === 'stairway' || nodeType === 'elevator') && (
                  <div>
                    <Label>Connected Floors</Label>
                    <p className="text-xs text-muted-foreground mb-2">Select all floors this node connects to</p>
                    <div className="space-y-2">
                      {floorsForBuilding.map(floor => (
                        <div key={floor.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`floor-${floor.id}`}
                            checked={connectedFloorIds.includes(floor.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setConnectedFloorIds([...connectedFloorIds, floor.id]);
                              } else {
                                setConnectedFloorIds(connectedFloorIds.filter(id => id !== floor.id));
                              }
                            }}
                            data-testid={`checkbox-floor-${floor.id}`}
                          />
                          <Label htmlFor={`floor-${floor.id}`} className="font-normal cursor-pointer">
                            {floor.floorName || `Floor ${floor.floorNumber}`}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!selectedFloorId || !x || !y}
                  data-testid="button-submit-node"
                >
                  {editingNode ? 'Update Node' : 'Create Node'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
            data-testid="input-search-nodes"
          />
        </div>

        {filteredNodes.length === 0 ? (
          <Card className="p-8 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Indoor Nodes Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create nodes to enable transitions between floors and entrance points
            </p>
            <Button onClick={() => handleOpenDialog()} data-testid="button-create-first-node">
              <Plus className="w-4 h-4 mr-2" />
              Create First Node
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredNodes.map(node => (
              <Card key={node.id} className="p-4" data-testid={`card-indoor-node-${node.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-4 h-4 rounded-full ${getNodeColor(node.type)}`} />
                      <h3 className="font-semibold">{node.label || node.type}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {floors.find(f => f.id === node.floorId)?.floorName || `Floor ${node.floorId}`}
                    </p>
                    <div className="text-xs text-muted-foreground mt-1">
                      Position: ({node.x.toFixed(0)}, {node.y.toFixed(0)})
                    </div>
                    {node.connectedFloorIds && node.connectedFloorIds.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Connects to {node.connectedFloorIds.length} floor{node.connectedFloorIds.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenDialog(node)}
                      data-testid={`button-edit-node-${node.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeletingNode(node)}
                      data-testid={`button-delete-node-${node.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!deletingNode} onOpenChange={() => setDeletingNode(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Node</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingNode?.label || deletingNode?.type}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingNode && deleteIndoorNode.mutate(deletingNode.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
