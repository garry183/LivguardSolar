import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const BASE_URL = __ENV.STAGING_URL;

export const options = {
  stages: [
    { duration: '2m', target: 20 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<750'],
    errors: ['rate<0.01'],
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

    const ok = check(res, {
      'status 200':       (r) => r.status === 200,
      'response < 750ms': (r) => r.timings.duration < 750,
    });
    errorRate.add(!ok);
    sleep(1);
  });
}
