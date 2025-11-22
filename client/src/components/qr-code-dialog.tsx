import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface QRCodeDialogProps {
  open: boolean;
  onClose: () => void;
  routeId: string;
}

export default function QRCodeDialog({ open, onClose, routeId }: QRCodeDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && routeId) {
      setError(null);
      setQrDataUrl(null);
      generateQRCode();
    }
  }, [open, routeId]);

  const generateQRCode = async () => {
    try {
      const navigationUrl = `${window.location.origin}/navigate/${routeId}`;
      console.log('Generating QR code for URL:', navigationUrl);

      // Generate QR code as data URL
      const dataUrl = await QRCode.toDataURL(navigationUrl, {
        errorCorrectionLevel: 'H' as any,
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      } as any);

      setQrDataUrl(dataUrl);
      setError(null);
      console.log('QR code generated successfully');
    } catch (err) {
      console.error('Error generating QR code:', err);
      setError('Failed to generate QR code. Please try again.');
    }
  };


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md z-[9999]" data-testid="dialog-qr-code">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Navigate on Your Phone
          </DialogTitle>
          <DialogDescription>
            Scan this QR code with your phone to continue navigation on mobile
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {error ? (
            <div className="text-destructive text-sm text-center p-4 border border-destructive rounded-md">
              {error}
            </div>
          ) : qrDataUrl ? (
            <div className="w-full flex justify-center">
              <img 
                src={qrDataUrl} 
                alt="QR Code"
                style={{
                  width: '300px',
                  height: '300px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white'
                }}
                data-testid="qr-code-image"
              />
            </div>
          ) : (
            <div className="w-full flex justify-center py-12">
              <div className="text-muted-foreground">Generating QR code...</div>
            </div>
          )}

          <div className="text-sm text-muted-foreground text-center">
            <p>Open your phone's camera app</p>
            <p>Point it at the QR code above</p>
            <p>Tap the notification to open the navigation</p>
          </div>

          {/* Internet Availability Disclaimer */}
          <div className="w-full mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
              Internet Required
            </p>
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              The scanned QR code will only load on your phone if the kiosk is connected to the internet. If the kiosk goes offline, the navigation link will not work.
            </p>
          </div>
        </div>

        <Button
          onClick={onClose}
          className="w-full"
          data-testid="button-close-qr"
        >
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
