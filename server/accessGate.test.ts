import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { accessGate } from "./_core/accessGate";

const basic = (user: string, pass: string) =>
  `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
function run(
  gate: ReturnType<typeof accessGate>,
  path: string,
  authorization?: string,
  ip = "1.1.1.1"
) {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    set(k: string, v: string) {
      this.headers[k] = v;
      return this;
    },
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    type() {
      return this;
    },
    send: vi.fn(),
  };
  const next = vi.fn();
  gate(
    { path, ip, headers: { authorization } } as unknown as Request,
    res as unknown as Response,
    next as NextFunction
  );
  return { res, next };
}

describe("accessGate", () => {
  it("deixa tudo aberto sem senha configurada", () => {
    expect(run(accessGate(undefined), "/").next).toHaveBeenCalled();
  });
  it("exige credenciais e libera /api/health", () => {
    const gate = accessGate("segredo");
    const denied = run(gate, "/");
    expect(denied.res.statusCode).toBe(401);
    expect(denied.res.headers["WWW-Authenticate"]).toContain("Basic");
    expect(run(gate, "/api/health").next).toHaveBeenCalled();
    expect(run(gate, "/api/status").next).toHaveBeenCalled();
    expect(run(gate, "/api/news").res.statusCode).toBe(401);
  });
  it("aceita usuário e senha corretos (senha com dois-pontos incluída)", () => {
    expect(
      run(accessGate("se:gredo"), "/", basic("radar", "se:gredo")).next
    ).toHaveBeenCalled();
    expect(
      run(accessGate("segredo"), "/", basic("radar", "errada")).res.statusCode
    ).toBe(401);
    expect(
      run(accessGate("segredo"), "/", basic("outro", "segredo")).res.statusCode
    ).toBe(401);
  });
  it("bloqueia o IP após 10 senhas erradas", () => {
    const gate = accessGate("segredo");
    for (let i = 0; i < 10; i++) run(gate, "/", basic("radar", "x"), "9.9.9.9");
    expect(
      run(gate, "/", basic("radar", "segredo"), "9.9.9.9").res.statusCode
    ).toBe(429);
    expect(
      run(gate, "/", basic("radar", "segredo"), "8.8.8.8").next
    ).toHaveBeenCalled();
  });
});
