import QRCode from 'qrcode';

export interface QRRenderOptions {
  foreground?: string;
  background?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  margin?: number;
  width?: number;
}

export async function generateQrPngBuffer(
  text: string,
  options: QRRenderOptions = {}
): Promise<Buffer> {
  const foreground = options.foreground || '#111111';
  const background = options.background || '#FFFFFF';
  const errorCorrectionLevel = options.errorCorrectionLevel || 'H';
  const margin = options.margin !== undefined ? options.margin : 2;
  const width = options.width || 600;

  return QRCode.toBuffer(text, {
    type: 'png',
    errorCorrectionLevel,
    margin,
    width,
    color: {
      dark: foreground,
      light: background,
    },
  });
}

export async function generateQrDataUrl(
  text: string,
  options: QRRenderOptions = {}
): Promise<string> {
  const foreground = options.foreground || '#111111';
  const background = options.background || '#FFFFFF';
  const errorCorrectionLevel = options.errorCorrectionLevel || 'H';
  const margin = options.margin !== undefined ? options.margin : 2;
  const width = options.width || 400;

  return QRCode.toDataURL(text, {
    errorCorrectionLevel,
    margin,
    width,
    color: {
      dark: foreground,
      light: background,
    },
  });
}

export async function generateQrSvgString(
  text: string,
  options: QRRenderOptions = {}
): Promise<string> {
  const foreground = options.foreground || '#111111';
  const background = options.background || '#FFFFFF';
  const errorCorrectionLevel = options.errorCorrectionLevel || 'H';
  const margin = options.margin !== undefined ? options.margin : 2;
  const width = options.width || 600;

  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel,
    margin,
    width,
    color: {
      dark: foreground,
      light: background,
    },
  });
}
