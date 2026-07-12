import { Hook } from './types';

export const provenanceStamp: Hook = async () => ({
  hook: 'provenance_stamp',
  passed: true
});
