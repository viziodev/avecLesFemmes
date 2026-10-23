import http from 'k6/http';
import { check, fail, sleep } from 'k6';

// Bounded local smoke/load run, without creating or changing any contributions.
const base = __ENV.BASE_URL || 'http://api:3000';
if (!/^http:\/\/(api|localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  throw new Error('Ce scénario est réservé à un environnement local isolé.');
}
if (!__ENV.LOAD_PASSWORD) throw new Error('LOAD_PASSWORD est requis.');
const vus = Number(__ENV.LOAD_VUS || 5);
if (!Number.isInteger(vus) || vus < 1 || vus > 20)
  throw new Error('LOAD_VUS doit être entre 1 et 20.');
export const options = {
  vus,
  duration: __ENV.LOAD_DURATION || '30s',
  noCookiesReset: true,
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{phase:read}': ['p(95)<1000'],
  },
};
let campaignPath;
function read(path, name) {
  const response = http.get(`${base}/api/v1${path}`, {
    tags: { name, phase: 'read' },
    timeout: '10s',
  });
  if (!check(response, { [`${name}: HTTP 200`]: (r) => r.status === 200 }))
    fail(`${name}: HTTP ${response.status}`);
  return response.json();
}
export default function () {
  if (!campaignPath) {
    const login = http.post(
      `${base}/api/v1/auth/login`,
      JSON.stringify({
        login: __ENV.LOAD_LOGIN || 'admin.ndeye',
        password: __ENV.LOAD_PASSWORD,
      }),
      {
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'AvecLesFemmes' },
        tags: { name: 'login', phase: 'auth' },
        timeout: '10s',
      },
    );
    if (
      !check(login, {
        'authentification et cookie': (r) => r.status === 201 && !!r.cookies.alf_session,
      })
    )
      fail('Authentification refusée.');
    const groups = read('/groupements?limit=100', 'groupements');
    const group = groups.items.find((item) => item.my_role === 'ADMIN' && item.active !== false);
    if (!group) fail('Aucun groupement administrable dans le jeu de test.');
    const campaigns = read(`/groupements/${group.id}/campaigns?limit=100`, 'campagnes');
    const campaign = campaigns.items.find((item) => item.active);
    if (!campaign) fail('Aucune campagne active dans le jeu de test.');
    campaignPath = `/groupements/${group.id}/campaigns/${campaign.id}`;
  }
  read(`${campaignPath}/dashboard`, 'tableau-de-bord');
  const participants = read(
    `${campaignPath}/participants?limit=25&q=Awa`,
    'recherche-participantes',
  );
  check(participants, {
    'pagination participantes': (data) =>
      Array.isArray(data.items) && typeof data.total === 'number',
  });
  const contributions = read(`${campaignPath}/contributions?limit=25`, 'historique');
  check(contributions, {
    'pagination versements': (data) => Array.isArray(data.items) && typeof data.total === 'number',
  });
  sleep(2);
}
