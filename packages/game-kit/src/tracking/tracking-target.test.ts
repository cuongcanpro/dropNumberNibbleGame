import { describe, expect, it } from 'vitest';
import { envFromBuild, resolveTrackingTarget } from './tracking-target';

describe('resolveTrackingTarget — 3 env của NB_CONSOLE', () => {
	it('local: endpoint localhost + key hardcode (vô hại)', () => {
		const t = resolveTrackingTarget('local', '');
		expect(t).toEqual({
			endpoint: 'http://localhost:3000/public/events',
			appKey: 'local-events-key',
		});
	});

	it('dev: endpoint app public dev + key TỪ BUILD (không hardcode secret)', () => {
		const t = resolveTrackingTarget('dev', 'nbc_dev_abc');
		expect(t).toEqual({
			endpoint: 'https://nibble-api.zingplay.dev/public/events',
			appKey: 'nbc_dev_abc',
		});
	});

	it('dev thiếu key → null (SDK nằm im, không đọng queue vô ích)', () => {
		expect(resolveTrackingTarget('dev', '')).toBeNull();
	});

	// 'staging' đã BỎ (chốt 05/09, thống nhất gọi là 'dev') và domain
	// nibble-console-api-staging đã NXDOMAIN. Giữ test này để một build cũ khai
	// staging thì nằm im thay vì bắn vào hư không.
	it("'staging' là env đã bỏ ⇒ null, không đoán thành dev", () => {
		expect(resolveTrackingTarget('staging' as never, 'k')).toBeNull();
	});

	// ĐỔI 18/09/2026. Trước đó endpoint live để RỖNG với lý do "chưa deploy live",
	// và lý do đó đúng cho tới 11/09 — hôm ấy live lên thật:
	//   GET https://nibble-api.zingplay.com/public/events/key-fingerprint → 7a25a609
	//   CI pipeline 106817 (MODE=release) in: events key 7a25a609 → KHỚP deployment.
	// Deployment mở cửa, khoá đúng, env đúng, mà bản live vẫn không gửi nổi một
	// event nào vì đúng một chuỗi rỗng trong ENDPOINTS. Câm mà KHÔNG có lỗi nên
	// không ai thấy — test này giữ cho nó không câm lại.
	it('live: endpoint app public live + key TỪ BUILD (không hardcode secret)', () => {
		const t = resolveTrackingTarget('live', 'nbc_live_abc');
		expect(t).toEqual({
			endpoint: 'https://nibble-api.zingplay.com/public/events',
			appKey: 'nbc_live_abc',
		});
	});

	it('live thiếu key → null (fail-closed y như dev, đừng bắn vào hư không)', () => {
		expect(resolveTrackingTarget('live', '')).toBeNull();
	});

	// 'prod' PHẢI vẫn null kể cả sau khi mở endpoint live: nó không phải tên env
	// hợp lệ. Đoán 'prod' thành 'live' là mở đường cho một chuỗi gõ sai bắn thẳng
	// vào hệ thật — đúng loại lỗi mà fail-closed sinh ra để chặn.
	it('env lạ / rỗng → null (fail-closed, không đoán)', () => {
		expect(resolveTrackingTarget('prod' as never, 'k')).toBeNull();
		expect(resolveTrackingTarget('' as never, 'k')).toBeNull();
	});

	it('build KHÔNG khai báo env → nằm im, KHÔNG đoán ra localhost', () => {
		// Regression 28/08: bản CDN dựng bởi CI (CI không set NB_CONSOLE_ENV) từng
		// mặc định 'local' ⇒ mang endpoint http://localhost:3000 ra máy người chơi,
		// event sinh ra rồi kẹt vĩnh viễn trong queue offline.
		expect(envFromBuild(undefined)).toBe('');
		expect(envFromBuild(null)).toBe('');
		expect(envFromBuild(123)).toBe('');
		expect(resolveTrackingTarget(envFromBuild(undefined), 'k')).toBeNull();
	});

	it('envFromBuild giữ nguyên giá trị khai báo tường minh', () => {
		expect(envFromBuild('local')).toBe('local');
		expect(envFromBuild('staging')).toBe('staging');
	});
});
