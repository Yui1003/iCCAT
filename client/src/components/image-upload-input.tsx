import { useState, useRef } from "react";
import { Upload, X, AlertCircle, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getProxiedImageUrl } from "./proxied-image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ImageUploadInputProps {
  label: string;
  value: string | string[] | null;
  onChange: (value: string | string[]) => void;
  type: "building" | "staff" | "event" | "floor";
  id: string;
  testId?: string;
  multiple?: boolean;
  onUploadingChange?: (isUploading: boolean) => void;
}

function SortableImage({ 
  imgUrl, 
  index, 
  onRemove, 
  testId 
}: { 
  imgUrl: string; 
  index: number; 
  onRemove: (index: number) => void;
  testId?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: imgUrl });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`relative group aspect-video ${isDragging ? 'opacity-50' : ''}`}
    >
      <img
        src={getProxiedImageUrl(imgUrl)}
        alt={`Preview ${index + 1}`}
        className="w-full h-full object-cover rounded-lg border"
      />
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-1 left-1 p-1 bg-black/50 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="w-4 h-4 text-white" />
      </div>
      <Button
        type="button"
        variant="destructive"
        size="icon"
        onClick={() => onRemove(index)}
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid={`button-remove-${testId}-${index}`}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

export default function ImageUploadInput({
  label,
  value,
  onChange,
  type,
  id,
  testId,
  multiple = false,
  onUploadingChange
}: ImageUploadInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const images = multiple 
    ? (Array.isArray(value) ? value : (value ? [value] : []))
    : (typeof value === 'string' && value ? [value] : []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);
    onUploadingChange?.(true);

    try {
      const newUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} size must be less than 10MB`);
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Only JPEG, PNG, WebP, and GIF files are allowed`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        formData.append('id', id);

        const response = await fetch('/api/upload-image', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }

        const { url } = await response.json();
        newUrls.push(url);
      }

      if (multiple) {
        onChange([...images, ...newUrls]);
      } else {
        onChange(newUrls[0]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      onUploadingChange?.(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (index: number) => {
    if (multiple) {
      const newImages = images.filter((_, i) => i !== index);
      onChange(newImages);
    } else {
      onChange("");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = images.indexOf(active.id as string);
      const newIndex = images.indexOf(over.id as string);
      onChange(arrayMove(images, oldIndex, newIndex));
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {images.length > 0 && multiple ? (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={images}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-2 mb-2">
              {images.map((imgUrl, index) => (
                <SortableImage 
                  key={imgUrl} 
                  imgUrl={imgUrl} 
                  index={index} 
                  onRemove={handleRemove} 
                  testId={testId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          {images.map((imgUrl, index) => (
            <div key={index} className="relative group aspect-video">
              <img
                src={getProxiedImageUrl(imgUrl)}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => handleRemove(index)}
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`button-remove-${testId}-${index}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex-1"
          data-testid={testId}
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? "Uploading..." : multiple ? (images.length > 0 ? "Add Photos" : "Upload Photos") : "Upload Image"}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple={multiple}
        onChange={handleFileSelect}
        className="hidden"
        data-testid={`input-file-${testId}`}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}