import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ClipboardService } from '../../../core/services/clipboard.service';
import { ExplainService } from '../../../core/services/explain.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { FileSystemAccessService } from '../../../core/services/file-system-access.service';
import { ExplainPanelComponent } from './explain-panel.component';

describe('ExplainPanelComponent', () => {
  let fixture: ComponentFixture<ExplainPanelComponent>;
  let component: ExplainPanelComponent;
  let explainServiceMock: { aggregateFiles: jest.Mock; aggregateUrl: jest.Mock };
  let clipboardServiceMock: { copyText: jest.Mock };
  let fileDownloadServiceMock: { downloadTextFile: jest.Mock };
  let fileSystemAccessMock: {
    isSupported: jest.Mock;
    isFilePickerSupported: jest.Mock;
    pickFile: jest.Mock;
    pickDirectory: jest.Mock;
  };

  const generated = {
    prompt: '# Explain This\n\nUpload `explain-this-files.md`.',
    fileCount: 3,
    attachmentFileName: 'explain-this-files.md',
    attachmentContent: '=== FILE: src/main.ts ===\n```typescript\nconst x = 1;\n```',
  };

  /** Creates the fixture; separate from beforeEach so tests can tweak the mocks first. */
  function createComponent(): void {
    fixture = TestBed.createComponent(ExplainPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    explainServiceMock = {
      aggregateFiles: jest.fn().mockReturnValue(of(generated)),
      aggregateUrl: jest.fn().mockReturnValue(of(generated)),
    };
    clipboardServiceMock = { copyText: jest.fn().mockResolvedValue(undefined) };
    fileDownloadServiceMock = { downloadTextFile: jest.fn() };
    fileSystemAccessMock = {
      isSupported: jest.fn().mockReturnValue(true),
      isFilePickerSupported: jest.fn().mockReturnValue(true),
      pickFile: jest.fn(),
      pickDirectory: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ExplainPanelComponent],
      providers: [
        { provide: ExplainService, useValue: explainServiceMock },
        { provide: ClipboardService, useValue: clipboardServiceMock },
        { provide: FileDownloadService, useValue: fileDownloadServiceMock },
        { provide: FileSystemAccessService, useValue: fileSystemAccessMock },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function byTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function typeUrl(url: string): void {
    const input = byTestId('explain-url-input') as HTMLInputElement;
    input.value = url;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function fakeFileHandle(name: string, content: string): FileSystemFileHandle {
    return {
      kind: 'file',
      name,
      getFile: () => Promise.resolve({ size: content.length, text: () => Promise.resolve(content) }),
    } as unknown as FileSystemFileHandle;
  }

  it('renders the wizard with pickers, URL input, and a disabled Confirm when nothing is selected', () => {
    createComponent();

    expect(byTestId('explain-panel')).toBeTruthy();
    expect(byTestId('explain-pick-file')).toBeTruthy();
    expect(byTestId('explain-pick-folder')).toBeTruthy();
    expect(byTestId('explain-url-input')).toBeTruthy();
    expect((byTestId('explain-confirm') as HTMLButtonElement).disabled).toBe(true);
    expect(byTestId('explain-result')).toBeNull();
  });

  it('hides the native picker buttons (but keeps the URL input) when the File System Access API is unsupported', () => {
    fileSystemAccessMock.isSupported.mockReturnValue(false);
    createComponent();

    expect(byTestId('explain-pick-file')).toBeNull();
    expect(byTestId('explain-pick-folder')).toBeNull();
    expect(byTestId('explain-url-input')).toBeTruthy();
  });

  describe('URL flow', () => {
    it('enables Confirm once a URL is typed, posts it, emits promptGenerated, and shows the result', async () => {
      createComponent();
      const emitted = jest.fn();
      component.promptGenerated.subscribe(emitted);

      typeUrl('https://github.com/owner/repo');
      expect((byTestId('explain-confirm') as HTMLButtonElement).disabled).toBe(false);

      byTestId('explain-confirm')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(explainServiceMock.aggregateUrl).toHaveBeenCalledWith('https://github.com/owner/repo');
      expect(explainServiceMock.aggregateFiles).not.toHaveBeenCalled();
      expect(emitted).toHaveBeenCalledWith(generated);
      expect(byTestId('explain-result')!.textContent).toContain('3 files');
      expect(byTestId('explain-copy-prompt')).toBeTruthy();
      expect(byTestId('explain-download-attachment')!.textContent).toContain('explain-this-files.md');
    });

    it('surfaces the backend ProblemDetails title when the request fails', async () => {
      explainServiceMock.aggregateUrl.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { title: 'Only GitHub and GitLab URLs are supported.' } })),
      );
      createComponent();

      typeUrl('https://example.com/owner/repo');
      byTestId('explain-confirm')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(byTestId('explain-error')!.textContent).toContain('Only GitHub and GitLab URLs are supported.');
      expect(byTestId('explain-result')).toBeNull();
    });
  });

  describe('local file flow', () => {
    it('shows the picked file name and posts its path+content on Confirm', async () => {
      fileSystemAccessMock.pickFile.mockResolvedValue(fakeFileHandle('notes.md', '# notes'));
      createComponent();

      byTestId('explain-pick-file')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(byTestId('explain-selection')!.textContent).toContain('File: notes.md');

      await component.onConfirmClicked();
      fixture.detectChanges();

      expect(explainServiceMock.aggregateFiles).toHaveBeenCalledWith([{ path: 'notes.md', content: '# notes' }]);
      expect(byTestId('explain-result')).toBeTruthy();
    });

    it('rejects a picked file whose extension the aggregation policy does not accept', async () => {
      fileSystemAccessMock.pickFile.mockResolvedValue(fakeFileHandle('photo.png', 'binary'));
      createComponent();

      byTestId('explain-pick-file')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(byTestId('explain-error')!.textContent).toContain('not a supported file type');
      expect(byTestId('explain-selection')).toBeNull();
    });

    it('does nothing when the picker is cancelled', async () => {
      fileSystemAccessMock.pickFile.mockResolvedValue(null);
      createComponent();

      byTestId('explain-pick-file')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(byTestId('explain-selection')).toBeNull();
      expect((byTestId('explain-confirm') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('local folder flow', () => {
    it('requests a read-only directory picker, walks the folder, and posts the collected entries', async () => {
      const folder = {
        kind: 'directory',
        name: 'my-repo',
        async *values() {
          yield {
            kind: 'file',
            name: 'main.ts',
            getFile: () => Promise.resolve({ size: 12, text: () => Promise.resolve('const x = 1;') }),
          };
        },
      } as unknown as FileSystemDirectoryHandle;
      fileSystemAccessMock.pickDirectory.mockResolvedValue(folder);
      createComponent();

      byTestId('explain-pick-folder')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fileSystemAccessMock.pickDirectory).toHaveBeenCalledWith('read');
      expect(byTestId('explain-selection')!.textContent).toContain('Folder: my-repo');

      await component.onConfirmClicked();
      fixture.detectChanges();

      expect(explainServiceMock.aggregateFiles).toHaveBeenCalledWith([{ path: 'main.ts', content: 'const x = 1;' }]);
      expect(byTestId('explain-result')).toBeTruthy();
    });
  });

  describe('mutually exclusive selection', () => {
    it('typing a URL clears a previously picked file', async () => {
      fileSystemAccessMock.pickFile.mockResolvedValue(fakeFileHandle('notes.md', '# notes'));
      createComponent();

      byTestId('explain-pick-file')!.click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(byTestId('explain-selection')).toBeTruthy();

      typeUrl('https://github.com/owner/repo');
      expect(byTestId('explain-selection')).toBeNull();

      byTestId('explain-confirm')!.click();
      await fixture.whenStable();

      expect(explainServiceMock.aggregateUrl).toHaveBeenCalled();
      expect(explainServiceMock.aggregateFiles).not.toHaveBeenCalled();
    });

    it('picking a file clears a previously typed URL', async () => {
      fileSystemAccessMock.pickFile.mockResolvedValue(fakeFileHandle('notes.md', '# notes'));
      createComponent();

      typeUrl('https://github.com/owner/repo');
      byTestId('explain-pick-file')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect((byTestId('explain-url-input') as HTMLInputElement).value).toBe('');

      await component.onConfirmClicked();

      expect(explainServiceMock.aggregateFiles).toHaveBeenCalled();
      expect(explainServiceMock.aggregateUrl).not.toHaveBeenCalled();
    });
  });

  describe('copy prompt', () => {
    it('copies the generated prompt and shows a transient Copied! confirmation', async () => {
      jest.useFakeTimers();
      try {
        createComponent();
        typeUrl('https://github.com/owner/repo');
        byTestId('explain-confirm')!.click();
        await fixture.whenStable();
        fixture.detectChanges();

        byTestId('explain-copy-prompt')!.click();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(clipboardServiceMock.copyText).toHaveBeenCalledWith(generated.prompt);
        expect(byTestId('explain-copy-prompt')!.textContent).toContain('Copied!');

        jest.advanceTimersByTime(2000);
        fixture.detectChanges();
        expect(byTestId('explain-copy-prompt')!.textContent).toContain('Copy prompt to clipboard');
      } finally {
        jest.useRealTimers();
      }
    });

    it('surfaces a clipboard failure through the inline error', async () => {
      clipboardServiceMock.copyText.mockRejectedValue(new Error('The clipboard is not available in this browser.'));
      createComponent();
      typeUrl('https://github.com/owner/repo');
      byTestId('explain-confirm')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      byTestId('explain-copy-prompt')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(byTestId('explain-error')!.textContent).toContain('The clipboard is not available in this browser.');
    });
  });

  describe('download attachment', () => {
    it('downloads only the aggregated files using the server-provided filename', async () => {
      createComponent();
      typeUrl('https://github.com/owner/repo');
      byTestId('explain-confirm')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      byTestId('explain-download-attachment')!.click();

      expect(fileDownloadServiceMock.downloadTextFile).toHaveBeenCalledWith(
        generated.attachmentFileName,
        generated.attachmentContent,
      );
      expect(fileDownloadServiceMock.downloadTextFile).not.toHaveBeenCalledWith(
        generated.attachmentFileName,
        generated.prompt,
      );
    });

    it('replaces the downloadable attachment when a later generation succeeds', async () => {
      const replacement = {
        prompt: '# Explain This\n\nReplacement prompt for `explain-this-files.md`.',
        fileCount: 1,
        attachmentFileName: 'explain-this-files.md',
        attachmentContent: '=== FILE: replacement.cs ===\n```csharp\nclass Replacement {}\n```',
      };
      explainServiceMock.aggregateUrl
        .mockReturnValueOnce(of(generated))
        .mockReturnValueOnce(of(replacement));
      createComponent();

      typeUrl('https://github.com/owner/first');
      byTestId('explain-confirm')!.click();
      await fixture.whenStable();
      typeUrl('https://github.com/owner/replacement');
      byTestId('explain-confirm')!.click();
      await fixture.whenStable();
      fixture.detectChanges();

      byTestId('explain-download-attachment')!.click();

      expect(fileDownloadServiceMock.downloadTextFile).toHaveBeenCalledTimes(1);
      expect(fileDownloadServiceMock.downloadTextFile).toHaveBeenCalledWith(
        replacement.attachmentFileName,
        replacement.attachmentContent,
      );
    });
  });
});
