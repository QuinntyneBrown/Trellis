import { Injectable } from '@angular/core';

/**
 * Parses the intrinsic pixel size of an SVG document from its width/height
 * attributes (PlantUML emits e.g. width="130px"), falling back to the
 * viewBox. Exported for direct unit testing -- jsdom cannot exercise the
 * canvas rasterization around it.
 */
export function parseSvgDimensions(svg: string): { width: number; height: number } {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;

  const width = parseFloat(root.getAttribute('width') ?? '');
  const height = parseFloat(root.getAttribute('height') ?? '');
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }

  const viewBox = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(parseFloat);
  if (viewBox.length === 4 && Number.isFinite(viewBox[2]) && Number.isFinite(viewBox[3]) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] };
  }

  throw new Error('The diagram SVG has no usable dimensions.');
}

// Fixed 2x (rather than devicePixelRatio) so an exported diagram is crisp on
// high-DPI displays yet byte-identical regardless of the screen it was
// exported from.
const PNG_EXPORT_SCALE = 2;

/**
 * Rasterizes an SVG string to a PNG Blob via the object URL -> Image ->
 * canvas.toBlob pipeline. The SVG comes from the server's PlantUML renderer
 * and is self-contained (no external resources), so the canvas is never
 * tainted. An injectable service so consumers' specs can mock rasterization
 * away -- jsdom implements neither object URLs nor canvas drawing.
 */
@Injectable({
  providedIn: 'root',
})
export class ImageExportService {
  async svgToPngBlob(svg: string): Promise<Blob> {
    const { width, height } = parseSvgDimensions(svg);

    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    let image: HTMLImageElement;
    try {
      image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('The diagram SVG could not be loaded as an image.'));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * PNG_EXPORT_SCALE);
    canvas.height = Math.round(height * PNG_EXPORT_SCALE);

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('The diagram could not be drawn to a canvas.');
    }
    // Deterministic white background (matching the preview pane) rather than
    // trusting the SVG's own background styling to survive rasterization.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('The diagram could not be encoded as a PNG.'))),
        'image/png',
      );
    });
  }
}
