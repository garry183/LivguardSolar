import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

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

const pages = ['/', '/rooftop-solar', '/solar-for-home', '/solar-for-commercial'];

export default function () {
  const page = pages[Math.floor(Math.random() * pages.length)];
  const res = http.get(BASE_URL + page, { tags: { page } });

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'response < 750ms': (r) => r.timings.duration < 750,
  });
  errorRate.add(!ok);
  sleep(1);
}
