import { SpanAttribute, WithSpan, WithTracer } from "../src/lib.js";
import { Span, SpanStatusCode } from "@opentelemetry/api";

import { getTestSpans } from "@opentelemetry/contrib-test-utils";
import { ReadableSpan } from "@opentelemetry/sdk-trace-base";

import { expect } from "chai";

@WithTracer()
export class MyClass {
  constructor() {}

  @WithSpan()
  public static async aStaticMethod(@SpanAttribute("arg1") arg: string, @SpanAttribute("arg2") arg2: number) {
    return arg + arg2;
  }

  @WithSpan({ setOkStatusOnSuccess: false })
  public aMethod(arg: string, arg2: number) {
    const span = arguments[arguments.length - 1] as Span;
    span.setAttribute("custom.inner.attribute", arg + arg2);
    return arg + arg2;
  }

  @WithSpan()
  public async anAsyncMethod(@SpanAttribute("arg1") arg: string, @SpanAttribute("arg2") arg2: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(arg + arg2);
      }, 1000);
    });
  }

  @WithSpan({ spanName: "customSpanName" })
  public async anAsyncMethodWithError() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject("or nah");
        ("this a very bad error");
      }, 500);
    });
  }

  @WithSpan({ setErrorStatusOnException: false })
  public async anAsyncMethodWithError2() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject("or nah");
        ("this a very bad error");
      }, 500);
    });
  }
}

describe("Instrumentation Testing", () => {
  beforeEach(async () => {
    const myInstance = new MyClass();
    const resultAsync = await myInstance.anAsyncMethod("test", 123);
    const r1 = myInstance.aMethod("test", 123);
    const r2 = await MyClass.aStaticMethod("test", 123);
    const r3 = await myInstance.anAsyncMethodWithError();
    const r4 = await myInstance.anAsyncMethodWithError2();
  });
  it("should create 5 spans", async () => {
    const spans: ReadableSpan[] = getTestSpans();
    expect(spans.length).to.equal(5);
  });
  it("should create spans with accurate names", async () => {
    const spans: ReadableSpan[] = getTestSpans();
    expect(spans[0].name).to.equal("MyClass.anAsyncMethod");
    expect(spans[1].name).to.equal("MyClass.aMethod");
    expect(spans[2].name).to.equal("MyClass.aStaticMethod");
    expect(spans[3].name).to.equal("customSpanName");
  });

  it("should set span status to error on exception by default", async () => {
    const spans: ReadableSpan[] = getTestSpans();
    expect(spans[3].status.code).to.equal(SpanStatusCode.ERROR);
  });

  it("should not set span status to error if setErroStatusOnException is false", async () => {
    const spans: ReadableSpan[] = getTestSpans();
    expect(spans[4].status.code).to.not.eq(SpanStatusCode.ERROR);
  });

  it("should span status to OK by default", async () => {
    const spans: ReadableSpan[] = getTestSpans();
    expect(spans[0].status.code).to.equal(SpanStatusCode.OK);
  });

  it("should leave span status to UNSET if setOkStatusOnSuccess is false", async () => {
    const spans: ReadableSpan[] = getTestSpans();
    expect(spans[1].status.code).to.equal(SpanStatusCode.UNSET);
  });

  it("should set span attributes with parameter when @SpanAttribute is used", async () => {
    const spans: ReadableSpan[] = getTestSpans();
    expect(spans[2].attributes).to.have.property("parameter.arg1", "test");
  });
});
