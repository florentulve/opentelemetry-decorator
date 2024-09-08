import { diag, Span, SpanOptions, SpanStatusCode, trace } from "@opentelemetry/api";
import { SpanAttribute, WithSpan, WithTracer } from "./src/lib.js";

const mypkg = process.env.OTEL_SERVICE_NAME ?? "testing-otel-decorator";

@WithTracer(mypkg)
export class MyClass {
  constructor() {}

  @WithSpan()
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

  @WithSpan()
  public async aAsyncMethod(@SpanAttribute("arg1") arg: string, @SpanAttribute("arg2") arg2: number) {
    console.log("inside aAsyncMethod");
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(arg + arg2);
      }, 1000);
    });
  }

  @WithSpan({ spanName: "customSpanName" })
  public async anAsyncMethodWithError() {
    console.log("inside anAsyncMethodWithError");
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject("or nah");
        ("this a very bad error");
      }, 5000);
    });
  }
}

trace.getTracer("main").startActiveSpan("mainSpan", async (span: Span) => {
  try {
    const myInstance = new MyClass();
    console.log(`#### calling aAsyncMethod`);
    const resultAsync = await myInstance.aAsyncMethod("test", 123);
    console.log(`result ${resultAsync}`);
    console.log(`#### calling aMethod`);
    const r1 = myInstance.aMethod("test", 123);
    console.log(`result ${r1}`);
    console.log(`#### calling aStaticMethod`);
    const r2 = await MyClass.aStaticMethod("test", 123);
    console.log(`result ${r2}`);
    const r3 = await myInstance.anAsyncMethodWithError();
    console.log(`result ${r3}`);
  } finally {
    span.end();
  }
});
