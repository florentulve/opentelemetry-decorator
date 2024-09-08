import { diag, Span, SpanOptions, SpanStatusCode, trace } from "@opentelemetry/api";
import "reflect-metadata";

const spanAttributeMetadataKey = Symbol("SpanAttribute");
const withTracerNameMetadataKey = Symbol("WithTracerNameMetadataKey");

export interface WithSpanOptions {
  /**
   * Name of the tracer ie the application name or the library name
   * @defaultValue tracer name popuplated with the class decorator {@link WithTracer} or the class name if no decorator is used
   */
  tracerName?: string;
  /**
   * Name of the span
   * @defaultValue `${class.name}.${method.name}`
   */
  spanName?: string;
  /**
   * Will record exception in span with span.recordException(error)
   * @defaultValue true
   */
  recordException?: boolean;
  /**
   * Define if the span status should be set to error if an exception is thrown
   * @defaultValue true
   */
  setErrorStatusOnException?: boolean;
  /**
   * Define if the span status should be set to error if an exception is thrown
   * @defaultValue true
   */
  setOkStatusOnSuccess?: boolean;
  /**
   * Will record result in a span attribute "attribute" with span.setAttribute("result", result)
   * @defaultValue false
   */
  recordResult?: boolean;
}

const DEFAULT_WITH_SPAN_OPTIONS: WithSpanOptions = {
  recordException: true,
  recordResult: false,
  setErrorStatusOnException: true,
  setOkStatusOnSuccess: true,
};

/**
 * Set the tracer name used for retrieving the tracer from the global tracer provider with trace.getTracer
 *
 * https://opentelemetry.io/docs/languages/java/instrumentation/#acquiring-a-tracer
 *
 * @param tracerName  should uniquely identify the Instrumentation Scope, such as the package, module or class name
 * @defaultValue ClassName
 * @param tracerVersion tracer version ie the application name, the package name or the library name
 * @defaultValue null
 */
export function WithTracer(tracerName?: string, tracerVersion?: string): ClassDecorator {
  return function (target: any) {
    Reflect.defineMetadata(withTracerNameMetadataKey, [tracerName, tracerVersion], target.prototype);
  };
}

/**
 * Wrap the decorated function with a new span using tracer.startActiveSpan
 * Provide the span as the last parameter of the function.
 *
 * @remarks @see {@link https://opentelemetry.io/docs/languages/js/instrumentation/#create-spans} for more details.
 * @remarks @see {@link https://opentelemetry.io/docs/languages/js/instrumentation/#span-events} for more details.
 * @remarks @see {@link https://opentelemetry.io/docs/languages/js/instrumentation/#span-status} for more details.
 * To get the span use the following code:
 *
 * import { Span } from "@opentelemetry/api";
 * const span = arguments[arguments.length - 1] as Span;
 * You may add custom attributes to the span using
 *
 * ```
 * span.setAttribute("attribute", value);
 * //You may add event
 * span.addEvent("eventName");
 * //You may also change the status of the span
 * span.setStatus({ code: SpanStatusCode.ERROR, message: "error message" });
 * ```
 *
 *
 *
 *
 *
 * @remarks
 * See {@link https://opentelemetry.io/docs/languages/js/instrumentation/#create-spans} for more details.
 *
 * @remarks
 * See {@link WithSpanOptions} for more details.
 *
 * @param options
 *
 */
export function WithSpan(options?: WithSpanOptions): MethodDecorator {
  let computedOptions: WithSpanOptions = Object.assign({}, DEFAULT_WITH_SPAN_OPTIONS, options);
  return function (target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any>) {
    const method = descriptor.value;
    let t = target.prototype ?? target; //target may be a prototype or a class depend on method type: static or instance
    descriptor.value = function (...args: any[]) {
      //Fetch metadata from prototype
      const spanAttributeMetadatas = Reflect.getOwnMetadata(spanAttributeMetadataKey, t, propertyKey);
      const [tracerName, tracerVersion] = Reflect.getOwnMetadata(withTracerNameMetadataKey, t);
      const tracer = trace.getTracer(computedOptions.tracerName ?? tracerName, tracerVersion);

      //Wrap original method in a span
      return tracer.startActiveSpan(computedOptions.spanName ?? `${target.name ?? target.constructor.name}.${method.name}`, (span: Span) => {
        //Add span attribute from metadata populated by SpanAttribute decorator
        for (let i in spanAttributeMetadatas) {
          const { name, index } = spanAttributeMetadatas[i];
          span.setAttribute(`parameter.${name}`, args[index]);
        }
        let result;
        try {
          result = method.apply(this, [...args, span]);
        } catch (error: any) {
          computedOptions.recordException && span.recordException(error);
          computedOptions.setErrorStatusOnException && span.setStatus({ code: SpanStatusCode.ERROR, message: "Error" });
          span.end();
          throw error;
        }
        if (result instanceof Promise) {
          return result
            .then((r) => {
              computedOptions.setOkStatusOnSuccess && span.setStatus({ code: SpanStatusCode.OK });
              computedOptions.recordResult && span.setAttribute("result", r);
              span.end();
              return r;
            })
            .catch((reason) => {
              computedOptions.recordException && span.recordException(reason, new Date());
              computedOptions.setErrorStatusOnException && span.setStatus({ code: SpanStatusCode.ERROR, message: "Error" });
              span.end();
              return reason;
            });
        } else {
          computedOptions.setOkStatusOnSuccess && span.setStatus({ code: SpanStatusCode.OK });
          computedOptions.recordResult && span.setAttribute("result", result);
          span.end();
          return result;
        }
      });
    };
  };
}

export function SpanAttribute(parameterName?: string): ParameterDecorator {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number): void {
    if (propertyKey == undefined) {
      return;
    }
    let t = target.prototype ?? target;
    let existingSpanAttribute: { name: string; index: number }[] = Reflect.getOwnMetadata(spanAttributeMetadataKey, t, propertyKey) || [];
    existingSpanAttribute.push({
      name: parameterName ?? propertyKey.toString(),
      index: parameterIndex,
    });
    Reflect.defineMetadata(spanAttributeMetadataKey, existingSpanAttribute, t, propertyKey);
  };
}
