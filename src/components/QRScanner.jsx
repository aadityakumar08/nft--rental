import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const QRScanner = ({ onScan, onError }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('qr-reader', {
      qrbox: {
        width: 250,
        height: 250,
      },
      fps: 5,
    });

    scanner.render(onScan, onError);

    return () => {
      scanner.clear();
    };
  }, [onScan, onError]);

  return <div id="qr-reader" className="rounded-xl overflow-hidden" />;
};

export default QRScanner;
