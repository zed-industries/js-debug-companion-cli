import { EventEmitter as NodeEventEmitter } from 'events';

export interface Disposable {
  dispose(): any;
}

export type Event<T> = (listener: (e: T) => any) => Disposable;

export class EventEmitter<T> {
  private readonly _emitter = new NodeEventEmitter();

  public readonly event: Event<T> = (listener: (e: T) => any): Disposable => {
    this._emitter.on('event', listener);
    return {
      dispose: () => {
        this._emitter.removeListener('event', listener);
      },
    };
  };

  public fire(data: T): void {
    this._emitter.emit('event', data);
  }
}

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  readonly onCancellationRequested: Event<any>;
}

class MutableToken implements CancellationToken {
  private _isCancelled: boolean = false;
  private _emitter: EventEmitter<any> | null = null;

  public cancel(): void {
    if (!this._isCancelled) {
      this._isCancelled = true;
      if (this._emitter) {
        this._emitter.fire(undefined);
      }
    }
  }

  get isCancellationRequested(): boolean {
    return this._isCancelled;
  }

  get onCancellationRequested(): Event<any> {
    if (!this._emitter) {
      this._emitter = new EventEmitter<any>();
    }
    return this._emitter.event;
  }
}

export class CancellationTokenSource implements Disposable {
  private _token: MutableToken | undefined;
  private _isCancelled: boolean = false;

  public get token(): CancellationToken {
    if (!this._token) {
      this._token = new MutableToken();
      if (this._isCancelled) {
        this._token.cancel();
      }
    }
    return this._token;
  }

  public cancel(): void {
    this._isCancelled = true;
    if (this._token) {
      this._token.cancel();
    }
  }

  public dispose(): void {
    this.cancel();
  }
}
