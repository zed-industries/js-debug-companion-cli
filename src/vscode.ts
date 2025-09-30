import { EventEmitter as NodeEventEmitter } from 'events';

export interface Disposable {
  dispose(): any;
}

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => any): Disposable;
}

export class CancellationTokenSource {
  private _cancelled = false;
  private _listeners: Array<() => any> = [];

  public readonly token: CancellationToken = {
    get isCancellationRequested(): boolean {
      return this._cancelled;
    },

    onCancellationRequested: (listener: () => any): Disposable => {
      if (this._cancelled) {
        // If already cancelled, call the listener immediately
        listener();
      } else {
        // Otherwise, add to the list of listeners
        this._listeners.push(listener);
      }

      return {
        dispose: () => {
          const index = this._listeners.indexOf(listener);
          if (index >= 0) {
            this._listeners.splice(index, 1);
          }
        },
      };
    },
  };

  public cancel(): void {
    if (!this._cancelled) {
      this._cancelled = true;
      // Call all registered listeners
      for (const listener of this._listeners) {
        listener();
      }
      // Clear listeners after calling them
      this._listeners = [];
    }
  }

  public dispose(): void {
    this._listeners = [];
  }
}

export type Event<T> = (listener: (e: T) => any) => Disposable;

export class EventEmitter<T> {
  private static _counter = 0;
  private readonly _emitter = new NodeEventEmitter();
  private readonly _eventName = `event_${EventEmitter._counter++}`;

  public readonly event: Event<T> = (listener: (e: T) => any): Disposable => {
    this._emitter.on(this._eventName, listener);
    return {
      dispose: () => {
        this._emitter.removeListener(this._eventName, listener);
      },
    };
  };

  public fire(data: T): void {
    this._emitter.emit(this._eventName, data);
  }

  public dispose(): void {
    this._emitter.removeAllListeners(this._eventName);
  }
}
