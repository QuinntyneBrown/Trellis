import { TestBed } from '@angular/core/testing';

import { ImageExportService, parseSvgDimensions } from './image-export.service';

// Realistic PlantUML root element: px-suffixed width/height plus a viewBox.
const PLANTUML_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="130px" height="120px" viewBox="0 0 130 120"><rect/></svg>';

describe('parseSvgDimensions', () => {
  it('reads px-suffixed width/height attributes', () => {
    expect(parseSvgDimensions(PLANTUML_SVG)).toEqual({ width: 130, height: 120 });
  });

  it('falls back to the viewBox when width/height attributes are absent', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"></svg>';

    expect(parseSvgDimensions(svg)).toEqual({ width: 640, height: 480 });
  });

  it('throws when no usable dimensions exist', () => {
    expect(() => parseSvgDimensions('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toThrow(
      'The diagram SVG has no usable dimensions.',
    );
  });
});

describe('ImageExportService', () => {
  let service: ImageExportService;
  let createObjectURLMock: jest.Mock;
  let revokeObjectURLMock: jest.Mock;
  let originalImage: unknown;
  let contextCalls: string[];
  let contextStub: {
    fillStyle: string;
    fillRect: jest.Mock;
    drawImage: jest.Mock;
  };
  let canvasStub: {
    width: number;
    height: number;
    getContext: jest.Mock;
    toBlob: jest.Mock;
  };
  let encodedBlob: Blob;

  /** Fires onload as soon as src is assigned -- jsdom never loads blob URLs. */
  class ImageStub {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageExportService);

    // jsdom implements neither object URLs nor canvas drawing, so the whole
    // SVG -> Image -> canvas -> PNG pipeline is asserted against stubs.
    createObjectURLMock = jest.fn().mockReturnValue('blob:mock-url');
    revokeObjectURLMock = jest.fn();
    (URL as unknown as Record<string, unknown>)['createObjectURL'] = createObjectURLMock;
    (URL as unknown as Record<string, unknown>)['revokeObjectURL'] = revokeObjectURLMock;

    originalImage = (globalThis as Record<string, unknown>)['Image'];
    (globalThis as Record<string, unknown>)['Image'] = ImageStub;

    contextCalls = [];
    contextStub = {
      fillStyle: '',
      fillRect: jest.fn(() => contextCalls.push('fillRect')),
      drawImage: jest.fn(() => contextCalls.push('drawImage')),
    };
    encodedBlob = new Blob(['fake-png'], { type: 'image/png' });
    canvasStub = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(contextStub),
      toBlob: jest.fn((callback: (blob: Blob | null) => void) => callback(encodedBlob)),
    };
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      return tagName === 'canvas' ? (canvasStub as unknown as HTMLElement) : originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    delete (URL as unknown as Record<string, unknown>)['createObjectURL'];
    delete (URL as unknown as Record<string, unknown>)['revokeObjectURL'];
    (globalThis as Record<string, unknown>)['Image'] = originalImage;
    jest.restoreAllMocks();
  });

  it('rasterizes at 2x with a white background fill before the SVG is drawn', async () => {
    const blob = await service.svgToPngBlob(PLANTUML_SVG);

    expect(blob).toBe(encodedBlob);
    expect(canvasStub.width).toBe(260);
    expect(canvasStub.height).toBe(240);
    expect(contextStub.fillStyle).toBe('#ffffff');
    expect(contextStub.fillRect).toHaveBeenCalledWith(0, 0, 260, 240);
    expect(contextCalls).toEqual(['fillRect', 'drawImage']);
    expect(canvasStub.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });

  it('rejects when PNG encoding yields no blob', async () => {
    canvasStub.toBlob.mockImplementation((callback: (blob: Blob | null) => void) => callback(null));

    await expect(service.svgToPngBlob(PLANTUML_SVG)).rejects.toThrow('The diagram could not be encoded as a PNG.');
  });

  it('rejects and still revokes the object URL when the image fails to load', async () => {
    (globalThis as Record<string, unknown>)['Image'] = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    };

    await expect(service.svgToPngBlob(PLANTUML_SVG)).rejects.toThrow(
      'The diagram SVG could not be loaded as an image.',
    );
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });
});
