// Vite nạp vite.config qua Node (strip-types): import tương đối không đuôi `.ts` không phân giải được,
// nên các file trong chuỗi này nối với nhau bằng exports của chính package (self-reference).
export * from '@repo/game-kit/vite/console-define';
export * from '@repo/game-kit/vite/listing-snapshot';
