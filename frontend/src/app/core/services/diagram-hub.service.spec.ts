import { TestBed } from '@angular/core/testing';

import { RenderResult } from '../models/render-result.model';
import { DiagramHubService } from './diagram-hub.service';

interface FakeHubConnection {
  start: jest.Mock;
  invoke: jest.Mock;
  onreconnecting: jest.Mock;
  onreconnected: jest.Mock;
  onclose: jest.Mock;
}

describe('DiagramHubService', () => {
  let fakeConnection: FakeHubConnection;
  let service: DiagramHubService;

  beforeEach(async () => {
    fakeConnection = {
      start: jest.fn().mockResolvedValue(undefined),
      invoke: jest.fn(),
      onreconnecting: jest.fn(),
      onreconnected: jest.fn(),
      onclose: jest.fn(),
    };

    jest
      .spyOn(DiagramHubService.prototype as unknown as { buildConnection(): unknown }, 'buildConnection')
      .mockReturnValue(fakeConnection);

    TestBed.configureTestingModule({});
    service = TestBed.inject(DiagramHubService);

    // Let the start().then(...) microtask resolve.
    await Promise.resolve();
    await Promise.resolve();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts the connection on construction and reports connected on success', () => {
    expect(fakeConnection.start).toHaveBeenCalledTimes(1);
    expect(service.connectionState()).toBe('connected');
  });

  it('wires reconnect/close callbacks that drive connectionState', () => {
    expect(fakeConnection.onreconnecting).toHaveBeenCalledTimes(1);
    expect(fakeConnection.onreconnected).toHaveBeenCalledTimes(1);
    expect(fakeConnection.onclose).toHaveBeenCalledTimes(1);

    fakeConnection.onreconnecting.mock.calls[0][0]();
    expect(service.connectionState()).toBe('reconnecting');

    fakeConnection.onreconnected.mock.calls[0][0]();
    expect(service.connectionState()).toBe('connected');

    fakeConnection.onclose.mock.calls[0][0]();
    expect(service.connectionState()).toBe('disconnected');
  });

  it('renders successfully, toggling isRendering and updating renderResult', async () => {
    const result: RenderResult = { isSuccess: true, svg: '<svg></svg>', errorMessage: null };
    fakeConnection.invoke.mockResolvedValue(result);

    const renderPromise = service.render('@startuml\n@enduml');
    expect(service.isRendering()).toBe(true);

    await renderPromise;

    expect(fakeConnection.invoke).toHaveBeenCalledWith('RenderDiagram', '@startuml\n@enduml');
    expect(service.renderResult()).toEqual(result);
    expect(service.isRendering()).toBe(false);
  });

  it('surfaces a resolved business-level failure through renderResult', async () => {
    const result: RenderResult = { isSuccess: false, svg: null, errorMessage: 'Syntax error at line 2' };
    fakeConnection.invoke.mockResolvedValue(result);

    await service.render('bad source');

    expect(service.renderResult()).toEqual(result);
  });

  it('funnels a connection-level rejection into renderResult as a failed result', async () => {
    fakeConnection.invoke.mockRejectedValue(new Error('connection lost'));

    await service.render('@startuml\n@enduml');

    expect(service.renderResult()).toEqual({
      isSuccess: false,
      svg: null,
      errorMessage: 'connection lost',
    });
    expect(service.isRendering()).toBe(false);
  });

  it('uses a generic message when a rejection carries no Error instance', async () => {
    fakeConnection.invoke.mockRejectedValue('boom');

    await service.render('@startuml\n@enduml');

    expect(service.renderResult()?.errorMessage).toBe('Failed to reach the render service.');
  });
});
