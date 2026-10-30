import { simulate } from './simulator.js';

self.onmessage = ({ data }) => {
  try {
    const result = simulate(data, (progress) => self.postMessage({ type: 'progress', progress }));
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
