import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

const TEST_API_KEY = 'test-api-key-12345';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				miniflare: {
					bindings: {
						API_KEY: TEST_API_KEY,
					},
				},
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
	},
});
