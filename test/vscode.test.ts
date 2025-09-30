import * as assert from 'assert';
import { EventEmitter, CancellationTokenSource } from '../src/vscode';

describe('EventEmitter', () => {
  it('should fire events to listeners', () => {
    const emitter = new EventEmitter<number>();
    let received: number | undefined;

    emitter.event(value => {
      received = value;
    });

    emitter.fire(42);
    assert.strictEqual(received, 42);
  });

  it('should support multiple listeners', () => {
    const emitter = new EventEmitter<string>();
    const values: string[] = [];

    emitter.event(value => values.push(`listener1:${value}`));
    emitter.event(value => values.push(`listener2:${value}`));

    emitter.fire('test');

    assert.strictEqual(values.length, 2);
    assert.strictEqual(values[0], 'listener1:test');
    assert.strictEqual(values[1], 'listener2:test');
  });

  it('should stop receiving events after dispose', () => {
    const emitter = new EventEmitter<number>();
    let count = 0;

    const disposable = emitter.event(() => {
      count++;
    });

    emitter.fire(1);
    assert.strictEqual(count, 1);

    disposable.dispose();
    emitter.fire(2);
    assert.strictEqual(count, 1); // Should not have incremented
  });

  it('should only remove the disposed listener', () => {
    const emitter = new EventEmitter<number>();
    let count1 = 0;
    let count2 = 0;

    const disposable1 = emitter.event(() => count1++);
    emitter.event(() => count2++);

    emitter.fire(1);
    assert.strictEqual(count1, 1);
    assert.strictEqual(count2, 1);

    disposable1.dispose();
    emitter.fire(2);
    assert.strictEqual(count1, 1); // Should not have incremented
    assert.strictEqual(count2, 2); // Should have incremented
  });
});

describe('CancellationToken', () => {
  it('should start as not cancelled', () => {
    const source = new CancellationTokenSource();
    const token = source.token;

    assert.strictEqual(token.isCancellationRequested, false);
  });

  it('should be cancelled after calling cancel', () => {
    const source = new CancellationTokenSource();
    const token = source.token;

    source.cancel();

    assert.strictEqual(token.isCancellationRequested, true);
  });

  it('should fire onCancellationRequested when cancelled', done => {
    const source = new CancellationTokenSource();
    const token = source.token;

    token.onCancellationRequested(() => {
      assert.strictEqual(token.isCancellationRequested, true);
      done();
    });

    source.cancel();
  });

  it('should return the same token instance on multiple calls', () => {
    const source = new CancellationTokenSource();
    const token1 = source.token;
    const token2 = source.token;
    const token3 = source.token;

    assert.strictEqual(token1, token2);
    assert.strictEqual(token2, token3);
  });

  it('should propagate cancellation to all token references', () => {
    const source = new CancellationTokenSource();
    const token1 = source.token;
    const token2 = source.token;
    const token3 = source.token;

    assert.strictEqual(token1.isCancellationRequested, false);
    assert.strictEqual(token2.isCancellationRequested, false);
    assert.strictEqual(token3.isCancellationRequested, false);

    source.cancel();

    assert.strictEqual(token1.isCancellationRequested, true);
    assert.strictEqual(token2.isCancellationRequested, true);
    assert.strictEqual(token3.isCancellationRequested, true);
  });

  it('should notify multiple listeners on cancellation', () => {
    const source = new CancellationTokenSource();
    const token = source.token;
    let count = 0;

    token.onCancellationRequested(() => count++);
    token.onCancellationRequested(() => count++);
    token.onCancellationRequested(() => count++);

    source.cancel();

    assert.strictEqual(count, 3);
  });

  it('should only fire cancellation once', () => {
    const source = new CancellationTokenSource();
    const token = source.token;
    let count = 0;

    token.onCancellationRequested(() => count++);

    source.cancel();
    source.cancel(); // Call cancel again
    source.cancel(); // And again

    assert.strictEqual(count, 1); // Should only fire once
  });

  it('should cancel when disposed', () => {
    const source = new CancellationTokenSource();
    const token = source.token;

    source.dispose();

    assert.strictEqual(token.isCancellationRequested, true);
  });

  it('should work when cancel is called before getting token', () => {
    const source = new CancellationTokenSource();

    source.cancel();
    const token = source.token;

    assert.strictEqual(token.isCancellationRequested, true);
  });
});
