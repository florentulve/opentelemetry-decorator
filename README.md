# Opetelemetry decorator

This package provides a set of decorators to instrument your code.

- _WithTracer_: Optionaly set the tracer name to for retrieving the tracer from the global tracer provider `trace.getTracer`
- _WithSpan_: Wrap the decorated function with a new span using `tracer.startActiveSpan`
- _SpanAttribute_: Will add the dedcorated parameter to the span attributes

If you do not understand what is going on, please read the [OpenTelemetry documentation](https://opentelemetry.io/docs/instrumentation/js/).

## Basic usage

```ts
@WithTracer(mypkg)
export class MyClass {
  constructor() {}

  @WithSpan({
    spanName: "customSpanName",
    recordException: false,
    setErrorStatusOnException: false,
    setOkStatusOnSuccess: false,
  })
  public static async aStaticMethod(@SpanAttribute("arg1") arg: string, @SpanAttribute("arg2") arg2: number) {
    console.log("inside aStaticMethod");
    return arg + arg2;
  }

  @WithSpan()
  public aMethod(arg: string, arg2: number) {
    console.log("inside aMethod");
    const span = arguments[arguments.length - 1] as Span;
    span.setAttribute("custom.inner.attribute", arg + arg2);
    return arg + arg2;
  }
}
```

## Testing

Run jaeger all in one

```bash
docker run -d --name jaeger-aio \
      -e COLLECTOR_ZIPKIN_HOST_PORT=:9411 \
      -p 6831:6831/udp \
      -p 6832:6832/udp \
      -p 5778:5778 \
      -p 16686:16686 \
      -p 4317:4317 \
      -p 4318:4318 \
      -p 14250:14250 \
      -p 14268:14268 \
      -p 14269:14269 \
      -p 9411:9411 \
      jaegertracing/all-in-one:1.60
```

Run the example

```bash
node --inspect --loader ts-node/esm -r '@opentelemetry/auto-instrumentations-node/register' ./example.ts
```
