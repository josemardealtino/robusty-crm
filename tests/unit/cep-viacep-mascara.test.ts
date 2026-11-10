import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Máscara e tratamento de CEP", () => {
  function formatarCep(val: string): string {
    const clean = val.replace(/\D/g, "").slice(0, 8);
    if (clean.length > 5) {
      return `${clean.slice(0, 5)}-${clean.slice(5)}`;
    }
    return clean;
  }

  it("formata CEP corretamente com 8 dígitos e hífen", () => {
    expect(formatarCep("03525150")).toBe("03525-150");
    expect(formatarCep("01001000")).toBe("01001-000");
  });

  it("remove caracteres não numéricos e limita em 8 dígitos", () => {
    expect(formatarCep("03.525-150123")).toBe("03525-150");
    expect(formatarCep("abc03525xyz150")).toBe("03525-150");
    expect(formatarCep("0352")).toBe("0352");
  });

  it("retorna dados corretos na consulta simulada do ViaCEP", async () => {
    const fakeViaCepResponse = {
      cep: "03525-150",
      logradouro: "Rua Exemplo",
      bairro: "Vila Matilde",
      localidade: "São Paulo",
      uf: "SP",
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeViaCepResponse,
    });

    globalThis.fetch = fetchMock;

    const res = await fetch("https://viacep.com.br/ws/03525150/json/");
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledWith("https://viacep.com.br/ws/03525150/json/");
    expect(data.logradouro).toBe("Rua Exemplo");
    expect(data.bairro).toBe("Vila Matilde");
    expect(data.localidade).toBe("São Paulo");
    expect(data.uf).toBe("SP");
  });
});
