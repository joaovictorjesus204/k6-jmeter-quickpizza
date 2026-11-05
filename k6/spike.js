// PICO: de 5 para 200 usuários em 10 segundos, como uma promoção anunciada
// na TV. Confere se a aplicação aguenta e se recupera. Só roda contra instância local.
import { exigirAlvoLocal } from './lib/config.js';
import { criarUsuarioELogar } from './lib/api.js';
import { jornadaDoCliente } from './lib/jornada.js';

exigirAlvoLocal('pico');

export const options = {
  stages: [
    { duration: '30s', target: 5 },    // uso normal
    { duration: '10s', target: 200 },  // pico repentino
    { duration: '1m', target: 200 },   // pico sustentado
    { duration: '10s', target: 5 },    // volta ao normal
    { duration: '30s', target: 5 },    // recuperação
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<5000'],
    regras_da_pizza_ok: ['rate==1'],
  },
};

export function setup() {
  return criarUsuarioELogar();
}

export default function ({ token }) {
  jornadaDoCliente(token);
}
