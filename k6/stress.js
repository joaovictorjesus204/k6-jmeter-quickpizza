// ESTRESSE: aumenta a carga em degraus até 150 usuários para encontrar o
// ponto em que o tempo de resposta degrada. Só roda contra instância local.
import { exigirAlvoLocal } from './lib/config.js';
import { criarUsuarioELogar } from './lib/api.js';
import { jornadaDoCliente } from './lib/jornada.js';

exigirAlvoLocal('estresse');

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 150 },
    { duration: '1m', target: 150 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Critérios mais largos: o objetivo é ver até onde aguenta, sem quebrar.
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
    regras_da_pizza_ok: ['rate==1'],
  },
};

export function setup() {
  return criarUsuarioELogar();
}

export default function ({ token }) {
  jornadaDoCliente(token);
}
