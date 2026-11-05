// CARGA: simula o uso normal esperado. Sobe até 10 usuários simultâneos,
// mantém por 2 minutos e desce. Leve o bastante para o ambiente público.
import { CRITERIOS_PADRAO } from './lib/config.js';
import { criarUsuarioELogar } from './lib/api.js';
import { jornadaDoCliente } from './lib/jornada.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // subida
    { duration: '2m', target: 10 },   // carga estável
    { duration: '30s', target: 0 },   // descida
  ],
  thresholds: {
    ...CRITERIOS_PADRAO,
    regras_da_pizza_ok: ['rate==1'],  // nenhuma regra de negócio pode quebrar sob carga
  },
};

export function setup() {
  return criarUsuarioELogar();
}

export default function ({ token }) {
  jornadaDoCliente(token);
}
