// Configuração comum a todos os testes k6.

// Alvo padrão: ambiente público do QuickPizza, que a Grafana mantém para
// testes de desempenho em pequena escala. Para rodar contra uma instância
// local (Docker), use: k6 run -e BASE_URL=http://localhost:3333 k6/load.js
export const BASE_URL = (__ENV.BASE_URL || 'https://quickpizza.grafana.com').replace(/\/$/, '');

export const ALVO_LOCAL = /localhost|127\.0\.0\.1|quickpizza:3333/.test(BASE_URL);

// Critérios de aceite (SLOs) usados como thresholds: se algum for violado,
// o k6 termina com erro e o pipeline falha.
export const CRITERIOS_PADRAO = {
  http_req_failed: ['rate<0.01'],                          // menos de 1% de erros
  http_req_duration: ['p(95)<1000'],                       // 95% das requisições em até 1 s
  'http_req_duration{endpoint:recomendacao}': ['p(95)<1500'],
  checks: ['rate>0.99'],                                   // mais de 99% das verificações aprovadas
};

// Testes de estresse e pico geram carga alta. Eles só rodam contra uma
// instância local, nunca contra o ambiente público.
export function exigirAlvoLocal(tipoDeTeste) {
  if (!ALVO_LOCAL) {
    throw new Error(
      `O teste de ${tipoDeTeste} gera carga alta e só roda contra uma instância local do QuickPizza. ` +
      'Suba o QuickPizza com Docker e rode com -e BASE_URL=http://localhost:3333'
    );
  }
}
