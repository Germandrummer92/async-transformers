export type PromiseWrapper<T> = {
  promise: Promise<T>;
};

export type AsyncBufferedTransformerOptions = {
  numberOfParallelExecutions: number;
};

export async function* asyncBufferedTransformer<T>(
  stream: AsyncIterable<PromiseWrapper<T>>,
  { numberOfParallelExecutions }: AsyncBufferedTransformerOptions,
  errorLogger: (message: string, ...params: any) => void = console.log
): AsyncIterable<T> {
  if (numberOfParallelExecutions < 2) {
    throw new Error('numberOfParallelExecutions, otherwise there is no parallel execution');
  }

  const bufferSize = numberOfParallelExecutions - 1;
  const buffer: (PromiseWrapper<T> | undefined)[] = new Array(bufferSize);
  let index = 0;
  try {
    for await (const wrapper of stream) {
      // Note: here we already pulled a promise _and_ have a buffer of bufferSize promises
      // that's why bufferSize + 1 = numberOfParallelExecutions
      const existingPromise = buffer[index];
      if (existingPromise) {
        yield await existingPromise.promise;
      }

      buffer[index] = wrapper;
      index = (index + 1) % bufferSize;
    }

    const limit = index;
    for (let index = limit; index < bufferSize; index++) {
      const promise = buffer[index];
      if (promise) {
        yield await promise.promise;
      }
    }
    for (let index = 0; index < limit; index++) {
      const promise = buffer[index];
      if (promise) {
        yield await promise.promise;
      }
    }
  } catch (error) {
    errorLogger('asyncBufferedTransformer: caught error, rethrowing:', error);
    // dont get any UnhandledPromiseRejection errors
    const promiseResults = await Promise.allSettled(buffer);
    const logOutput: { reason: string }[] = promiseResults.filter((p) => !!p && p.status === 'rejected') as {
      reason: string;
    }[];
    if (logOutput.length > 0) {
      errorLogger('asyncBufferedTransformer: caught additional errors, *NOT* rethrowing:', logOutput);
    }
    throw error;
  }
}

export const drainStream = async <T>(streamToDrain: AsyncIterable<T>): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of streamToDrain) {
    //we just drain
  }

  return;
};

export const collectAll = async <T>(streamToCollect: AsyncIterable<T>): Promise<T[]> => {
  const results = [];
  for await (const output of streamToCollect) {
    results.push(output);
  }

  return results;
};
