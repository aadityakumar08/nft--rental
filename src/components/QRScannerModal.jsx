import { X } from "lucide-react";
import QRScanner from "./QRScanner";

const QRScannerModal = ({ isOpen, onClose, onScan }) => {
  if (!isOpen) return null;

  const handleScan = (data) => {
    onScan(data);
    onClose();
  };

  const handleError = (err) => {
    console.error(err);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white">
            Scan QR Code
          </h3>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <QRScanner onScan={handleScan} onError={handleError} />
          <p className="text-center text-white/70 mt-4">
            Position the QR code within the frame to scan
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
