// pngjs không có @types trong repo — chỉ khai phần tool này dùng.
declare module 'pngjs' {
	export class PNG {
		constructor(options?: { width: number; height: number });
		width: number;
		height: number;
		data: Buffer;
		static sync: {
			read(buffer: Buffer): PNG;
			write(
				png: PNG,
				options?: { deflateLevel?: number; colorType?: number; filterType?: number },
			): Buffer;
		};
	}
}
