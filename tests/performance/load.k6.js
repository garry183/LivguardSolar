import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const status429 = new Counter('status_429');
const status5xx = new Counter('status_5xx');
const BASE_URL = __ENV.STAGING_URL;

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '3m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    errors:            ['rate<0.05'],
    http_req_failed:   ['rate<0.05'],
  },
};

const pages = {
  'homepage':             '/',
  'rooftop-solar':        '/rooftop-solar',
  'solar-for-home':       '/solar-for-home',
  'solar-for-commercial': '/solar-for-commercial',
};

const pageNames = Object.keys(pages);

// Per-page response time trends — metric names use underscores (k6 requirement)
const pageTrends = {
  'homepage':             new Trend('dur_homepage',             true),
  'rooftop-solar':        new Trend('dur_rooftop_solar',        true),
  'solar-for-home':       new Trend('dur_solar_for_home',       true),
  'solar-for-commercial': new Trend('dur_solar_for_commercial', true),
};

export default function () {
  const name = pageNames[Math.floor(Math.random() * pageNames.length)];

  group(name, function () {
    const res = http.get(BASE_URL + pages[name], { tags: { page: name } });

    pageTrends[name].add(res.timings.duration);

    if (res.status === 429) status429.add(1);
    if (res.status >= 500)  status5xx.add(1);

    const ok = check(res, {
      'status 200':        (r) => r.status === 200,
      'response < 1500ms': (r) => r.timings.duration < 1500,
    });
    errorRate.add(!ok);
    sleep(1);
  });
}
