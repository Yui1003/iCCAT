import { useState, useRef } from "react";
import { Upload, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getProxiedImageUrl } from "./proxied-image";

interface ImageUploadInputProps {
  label: string;
  value: string | null;
  onChange: (url: string) => void;
  type: "building" | "staff" | "event" | "floor";
  id: string;
  testId?: string;
}

export default function ImageUploadInput({
  label,
  value,
  onChange,
  type,
  id,
  testId
}: ImageUploadInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(value ? getProxiedImageUrl(value) : null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError("Only JPEG, PNG, WebP, and GIF files are allowed");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Upload to backend
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
      onChange(url);
      // Show the Firebase URL proxied through our endpoint for caching
      setPreview(getProxiedImageUrl(url));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    onChange("");
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {preview && (
        <div className="relative group">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={handleClear}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid={`button-clear-${testId}`}
          >
            <X className="w-4 h-4" />
          </Button>
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
          {isUploading ? "Uploading..." : "Upload Image"}
        </Button>
        {preview && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            data-testid={`button-remove-${testId}`}
          >
            Remove
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
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
